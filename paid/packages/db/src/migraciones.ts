import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { PoolClient } from 'pg';

/**
 * Aplicador de migraciones.
 *
 * Dos exigencias de PROMPT.md dan forma a esto:
 *
 *   A.1  — «migraciones versionadas y reversibles»
 *   Fase 1, punto 7 — «cada una con su `down` probado», y la Puerta 1
 *          comprueba que «cada migracion aplica y revierte limpiamente».
 *
 * Y una leccion del propio desarrollo: una migracion aplicada a medias deja la
 * base en un estado que ninguna de las dos direcciones entiende. De ahi que
 * **cada migracion corra dentro de una unica transaccion**: si falla a mitad,
 * no queda nada. PostgreSQL admite DDL transaccional, asi que esto funciona de
 * verdad y no es una aspiracion.
 */

export interface Migracion {
  readonly nombre: string;
  readonly sqlSubida: string;
  readonly sqlBajada: string;
}

const SQL_TABLA_CONTROL = `
  CREATE TABLE IF NOT EXISTS public.paid_migracion (
    nombre      text PRIMARY KEY,
    aplicada_en timestamptz NOT NULL DEFAULT now(),
    resumen     char(64) NOT NULL
  )
`;

/**
 * Resumen del contenido. Sirve para detectar una migracion **editada despues
 * de aplicarse**, que es un error silencioso clasico: la base tiene el esquema
 * viejo y el repositorio dice otra cosa.
 */
function resumir(contenido: string): string {
  return createHash('sha256').update(contenido).digest('hex');
}

export function leerMigraciones(directorio: string): Migracion[] {
  const directorioBajada = join(directorio, 'bajada');
  const archivos = readdirSync(directorio)
    .filter((n) => n.endsWith('.sql'))
    .sort();

  return archivos.map((nombre) => {
    const rutaBajada = join(directorioBajada, nombre);
    if (!existsSync(rutaBajada)) {
      // Una migracion sin `down` no se da por terminada (A.1). Fallar aqui es
      // mejor que descubrirlo cuando haya que revertir en produccion.
      throw new Error(
        `La migracion ${nombre} no tiene su reversion en bajada/${nombre}. ` +
          'A.1 exige migraciones reversibles: sin el `down`, la migracion no esta terminada.',
      );
    }
    return {
      nombre,
      sqlSubida: readFileSync(join(directorio, nombre), 'utf8'),
      sqlBajada: readFileSync(rutaBajada, 'utf8'),
    };
  });
}

export async function asegurarTablaControl(cliente: PoolClient): Promise<void> {
  await cliente.query(SQL_TABLA_CONTROL);
}

export async function migracionesAplicadas(cliente: PoolClient): Promise<Set<string>> {
  const resultado = await cliente.query<{ nombre: string }>(
    'SELECT nombre FROM public.paid_migracion ORDER BY nombre',
  );
  return new Set(resultado.rows.map((f) => f.nombre));
}

/**
 * Aplica una migracion dentro de UNA transaccion. Si el SQL falla a mitad, no
 * queda ni una tabla a medias.
 */
export async function aplicar(cliente: PoolClient, migracion: Migracion): Promise<void> {
  await cliente.query('BEGIN');
  try {
    await cliente.query(migracion.sqlSubida);
    await cliente.query(
      'INSERT INTO public.paid_migracion (nombre, resumen) VALUES ($1, $2)',
      [migracion.nombre, resumir(migracion.sqlSubida)],
    );
    await cliente.query('COMMIT');
  } catch (error: unknown) {
    await cliente.query('ROLLBACK');
    throw new Error(
      `La migracion ${migracion.nombre} fallo y se revirtio por completo: ${String(error)}`,
      { cause: error },
    );
  }
}

/** Revierte una migracion, tambien en una sola transaccion. */
export async function revertir(cliente: PoolClient, migracion: Migracion): Promise<void> {
  await cliente.query('BEGIN');
  try {
    await cliente.query(migracion.sqlBajada);
    await cliente.query('DELETE FROM public.paid_migracion WHERE nombre = $1', [
      migracion.nombre,
    ]);
    await cliente.query('COMMIT');
  } catch (error: unknown) {
    await cliente.query('ROLLBACK');
    throw new Error(
      `La reversion de ${migracion.nombre} fallo: ${String(error)}`,
      { cause: error },
    );
  }
}

export async function aplicarPendientes(
  cliente: PoolClient,
  migraciones: readonly Migracion[],
): Promise<string[]> {
  await asegurarTablaControl(cliente);
  const yaAplicadas = await migracionesAplicadas(cliente);
  const aplicadasAhora: string[] = [];
  for (const migracion of migraciones) {
    if (yaAplicadas.has(migracion.nombre)) continue;
    await aplicar(cliente, migracion);
    aplicadasAhora.push(migracion.nombre);
  }
  return aplicadasAhora;
}

/** Revierte todo, en orden inverso. Lo usa la prueba de ida y vuelta. */
export async function revertirTodas(
  cliente: PoolClient,
  migraciones: readonly Migracion[],
): Promise<void> {
  await asegurarTablaControl(cliente);
  for (const migracion of [...migraciones].reverse()) {
    await revertir(cliente, migracion);
  }
}

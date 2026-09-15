/**
 * R7 / P11 — Contexto de sesion en el pool de conexiones.
 *
 * ⚠️ ESTE ES EL ARCHIVO MAS DELICADO DEL PROYECTO. Leelo entero antes de
 * tocarlo.
 *
 * RLS (R6) y la bitacora (R15) necesitan saber **quien** ejecuta cada
 * sentencia. El mecanismo es:
 *
 *     SET LOCAL app.id_usuario = ...
 *     SET LOCAL app.id_unidad  = ...
 *     SET LOCAL app.id_sesion  = ...
 *
 * leido desde SQL con `current_setting('app.id_usuario', true)`.
 *
 * `SET LOCAL` (no `SET`) es **obligatorio**:
 *
 *   - `SET LOCAL` acota el valor a la transaccion en curso. Al terminar
 *     (COMMIT o ROLLBACK) el valor desaparece.
 *   - `SET` lo deja pegado a la **conexion**. Y el pool reutiliza conexiones
 *     entre peticiones: la siguiente peticion, de otra unidad, heredaria el
 *     contexto de la anterior. Eso es una **fuga de datos entre usuarios**,
 *     silenciosa, y practicamente invisible en una revision de codigo.
 *
 * De ahi que toda escritura y toda lectura sujeta a RLS vaya dentro de una
 * transaccion que fija el contexto en su **primera** sentencia. No hay camino
 * alternativo: no existe en este paquete ninguna funcion que ejecute SQL de
 * dominio fuera de `enTransaccionConContexto`.
 *
 * La Puerta 2 lo demuestra con `pool.max = 1`, forzando la reutilizacion de la
 * conexion: dos peticiones consecutivas de unidades distintas deben devolver
 * cada una solo sus filas.
 */

import type { PoolClient } from 'pg';

/** Claves de contexto que la base espera. Cerradas a proposito. */
export const CLAVES_CONTEXTO = {
  idUsuario: 'app.id_usuario',
  idUnidad: 'app.id_unidad',
  idSesion: 'app.id_sesion',
  direccionIp: 'app.direccion_ip',
} as const;

export interface ContextoSesion {
  readonly idUsuario: number;
  readonly idUnidad: number;
  readonly idSesion: string;
  /** Va a `aud.bitacora_cambio` (R15). */
  readonly direccionIp: string;
}

/**
 * `SET LOCAL` no admite parametros vinculados ($1): el valor tiene que ir
 * literal en la sentencia. Para no abrir una inyeccion por ahi, se usa
 * `set_config(clave, valor, true)`, que **si** los admite. El tercer argumento
 * `true` es exactamente el `is_local` de `SET LOCAL`.
 *
 * Si algun dia alguien cambia ese `true` por `false`, reintroduce P11. El test
 * de fuga de contexto de la Puerta 2 es lo que lo detecta.
 */
const SQL_FIJAR_CONTEXTO = `
  SELECT
    set_config($1, $2, true),
    set_config($3, $4, true),
    set_config($5, $6, true),
    set_config($7, $8, true)
`;

export async function fijarContexto(
  cliente: PoolClient,
  contexto: ContextoSesion,
): Promise<void> {
  await cliente.query(SQL_FIJAR_CONTEXTO, [
    CLAVES_CONTEXTO.idUsuario,
    String(contexto.idUsuario),
    CLAVES_CONTEXTO.idUnidad,
    String(contexto.idUnidad),
    CLAVES_CONTEXTO.idSesion,
    contexto.idSesion,
    CLAVES_CONTEXTO.direccionIp,
    contexto.direccionIp,
  ]);
}

/**
 * Lee el contexto vigente en la conexion. Existe **para las pruebas**: es como
 * el test de la Puerta 2 comprueba que, al empezar una transaccion nueva, no
 * queda nada del contexto anterior.
 */
export async function leerContexto(
  cliente: PoolClient,
): Promise<Record<string, string | null>> {
  const resultado = await cliente.query<{
    id_usuario: string | null;
    id_unidad: string | null;
    id_sesion: string | null;
  }>(
    `SELECT
       current_setting($1, true) AS id_usuario,
       current_setting($2, true) AS id_unidad,
       current_setting($3, true) AS id_sesion`,
    [CLAVES_CONTEXTO.idUsuario, CLAVES_CONTEXTO.idUnidad, CLAVES_CONTEXTO.idSesion],
  );
  const fila = resultado.rows[0];
  return {
    idUsuario: fila?.id_usuario ?? null,
    idUnidad: fila?.id_unidad ?? null,
    idSesion: fila?.id_sesion ?? null,
  };
}

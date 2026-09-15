import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { fijarContexto } from './contexto';
import type { ContextoSesion } from './contexto';

/**
 * Pool de conexiones y la unica puerta de entrada al SQL de dominio.
 *
 * Ver `contexto.ts` para el porque de `SET LOCAL`. Resumen: el pool reutiliza
 * conexiones, asi que el contexto de sesion tiene que morir con la
 * transaccion.
 */

export interface OpcionesPool {
  readonly url: string;
  readonly maximoConexiones: number;
}

export function crearPool(opciones: OpcionesPool): Pool {
  return new Pool({
    connectionString: opciones.url,
    max: opciones.maximoConexiones,
    // Todo instante en UTC (A.2.5). La conversion a America/Bogota ocurre en
    // el borde, nunca en la base ni en la logica de negocio.
    options: '-c timezone=UTC',
  });
}

/**
 * Ejecuta `trabajo` dentro de una transaccion que fija el contexto de sesion
 * en su **primera** sentencia (R7).
 *
 * Todo acceso a `ai`, `org` y `doc` pasa por aqui. Si aparece una consulta de
 * dominio que no pasa por aqui, es un defecto: RLS no tendra a quien mirar y
 * la bitacora quedara sin usuario.
 */
export async function enTransaccionConContexto<T>(
  pool: Pool,
  contexto: ContextoSesion,
  trabajo: (cliente: PoolClient) => Promise<T>,
): Promise<T> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    // Primera sentencia de la transaccion, sin excepcion.
    await fijarContexto(cliente, contexto);
    const resultado = await trabajo(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error: unknown) {
    await cliente.query('ROLLBACK').catch(() => {
      // Si el ROLLBACK tambien falla, la conexion esta perdida; `release`
      // con error la descarta del pool. Se propaga el error original, que es
      // el que explica que paso.
    });
    throw error;
  } finally {
    cliente.release();
  }
}

/**
 * Transaccion **sin** contexto de sesion. Solo para migraciones, semillas y
 * tareas del sistema que corren como administrador y no estan sujetas a RLS.
 *
 * No la uses para atender una peticion HTTP. Si lo haces, RLS no filtra nada.
 */
export async function enTransaccionDeSistema<T>(
  pool: Pool,
  trabajo: (cliente: PoolClient) => Promise<T>,
): Promise<T> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await trabajo(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error: unknown) {
    await cliente.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    cliente.release();
  }
}

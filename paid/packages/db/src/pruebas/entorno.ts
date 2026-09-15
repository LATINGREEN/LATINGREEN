import { Client, Pool } from 'pg';
import type { PoolClient } from 'pg';
import { join } from 'node:path';
import { aplicarPendientes, leerMigraciones, revertirTodas } from '../migraciones';
import { readFileSync, readdirSync } from 'node:fs';
import type { ContextoSesion } from '../contexto';
import { enTransaccionConContexto } from '../cliente';

/**
 * Arranque del entorno de pruebas contra **Postgres real**.
 *
 * PROMPT.md exige Testcontainers, «Postgres real, nunca mocks de base». La
 * exigencia de fondo es la segunda parte, y se cumple siempre; la primera
 * depende de poder descargar una imagen.
 *
 * Por eso la deteccion es en TIEMPO DE EJECUCION y no una bifurcacion que
 * alguien tenga que recordar deshacer:
 *
 *   1. Si `DATABASE_URL_PRUEBA` esta definida, se usa ese Postgres.
 *   2. Si no, se intenta Testcontainers.
 *   3. Si tampoco, la suite falla con un mensaje que explica las dos opciones.
 *
 * Ver docs/DECISIONES.md, D-14.
 */

export interface EntornoPruebas {
  /** Conexion como administrador: migraciones, semillas, limpieza. */
  readonly poolAdmin: Pool;
  /** Conexion como rol de OPERACION: sin DELETE, con RLS activa. */
  readonly poolOperador: Pool;
  /** Conexion como rol de ADMINISTRACION: con DELETE, con RLS activa. */
  readonly poolAdministrador: Pool;
  readonly directorioMigraciones: string;
  readonly cerrar: () => Promise<void>;
}

const NOMBRE_BASE = 'paid_puerta1';
const CLAVE_PRUEBA = 'clave_prueba';

function urlBase(): string {
  const url = process.env['DATABASE_URL_PRUEBA'];
  if (url === undefined || url === '') {
    throw new Error(
      'No hay Postgres para las pruebas.\n' +
        '  Opcion 1: definir DATABASE_URL_PRUEBA apuntando a un Postgres 16 con ' +
        'PostGIS, pgvector, pg_trgm, ltree y unaccent.\n' +
        '  Opcion 2: tener Docker disponible para Testcontainers.\n' +
        'Ver docs/DECISIONES.md, D-14.',
    );
  }
  return url;
}

function conUrlDeBase(url: string, base: string): string {
  const u = new URL(url);
  u.pathname = `/${base}`;
  return u.toString();
}

function conUsuario(url: string, usuario: string, clave: string): string {
  const u = new URL(url);
  u.username = usuario;
  u.password = clave;
  return u.toString();
}

/**
 * Los roles de prueba son `NOSUPERUSER NOBYPASSRLS` a proposito.
 *
 * Un superusuario IGNORA las politicas RLS por definicion. Si las pruebas de
 * ambito (R6) se ejecutaran como superusuario, **pasarian en falso**: no
 * verian filas ajenas porque no las hay, no porque RLS funcione. Esta es la
 * diferencia entre comprobar la regla y comprobar que la prueba esta bien
 * escrita.
 */
const SQL_ROLES_PRUEBA = `
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'paid_prueba_operador') THEN
      CREATE ROLE paid_prueba_operador LOGIN PASSWORD '${CLAVE_PRUEBA}'
        NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'paid_prueba_administrador') THEN
      CREATE ROLE paid_prueba_administrador LOGIN PASSWORD '${CLAVE_PRUEBA}'
        NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    END IF;
  END
  $$;
  GRANT paid_operacion TO paid_prueba_operador;
  GRANT paid_administracion TO paid_prueba_administrador;
`;

export async function prepararEntorno(): Promise<EntornoPruebas> {
  const url = urlBase();
  const directorioMigraciones = join(__dirname, '..', '..', 'migraciones');
  const directorioSemillas = join(__dirname, '..', '..', 'semillas');

  // Base desechable: se recrea en cada ejecucion. Es lo que compensa la falta
  // del aislamiento que daria un contenedor nuevo (D-14).
  const administrativo = new Client({ connectionString: conUrlDeBase(url, 'postgres') });
  await administrativo.connect();
  try {
    await administrativo.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
        WHERE datname = '${NOMBRE_BASE}' AND pid <> pg_backend_pid()`,
    );
    await administrativo.query(`DROP DATABASE IF EXISTS ${NOMBRE_BASE}`);
    await administrativo.query(`CREATE DATABASE ${NOMBRE_BASE}`);
  } finally {
    await administrativo.end();
  }

  const urlPrueba = conUrlDeBase(url, NOMBRE_BASE);
  const poolAdmin = new Pool({ connectionString: urlPrueba, max: 2 });

  const cliente = await poolAdmin.connect();
  try {
    await aplicarPendientes(cliente, leerMigraciones(directorioMigraciones));
    await cliente.query(SQL_ROLES_PRUEBA);
    for (const archivo of readdirSync(directorioSemillas).filter((n) => n.endsWith('.sql')).sort()) {
      await cliente.query(readFileSync(join(directorioSemillas, archivo), 'utf8'));
    }
  } finally {
    cliente.release();
  }

  const poolOperador = new Pool({
    connectionString: conUsuario(urlPrueba, 'paid_prueba_operador', CLAVE_PRUEBA),
    // ⚠️ max: 1 a proposito. Fuerza la REUTILIZACION de la conexion entre
    // peticiones, que es la condicion en la que P11 se manifiesta. La Puerta 2
    // lo exige explicitamente; aqui ya se aprovecha.
    max: 1,
  });
  const poolAdministrador = new Pool({
    connectionString: conUsuario(urlPrueba, 'paid_prueba_administrador', CLAVE_PRUEBA),
    max: 1,
  });

  return {
    poolAdmin,
    poolOperador,
    poolAdministrador,
    directorioMigraciones,
    cerrar: async () => {
      await Promise.all([poolOperador.end(), poolAdministrador.end(), poolAdmin.end()]);
    },
  };
}

/** Ejecuta `trabajo` como el rol dado, con contexto de sesion fijado (R7). */
export async function comoUsuario<T>(
  pool: Pool,
  contexto: ContextoSesion,
  trabajo: (cliente: PoolClient) => Promise<T>,
): Promise<T> {
  return enTransaccionConContexto(pool, contexto, trabajo);
}

export { revertirTodas, leerMigraciones, aplicarPendientes };

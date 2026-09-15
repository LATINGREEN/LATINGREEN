import { Client, Pool } from 'pg';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { aplicarPendientes, archivosDeSemillas, leerMigraciones } from '@paid/db';
import Redis from 'ioredis';

/*
 * ⚠️ `AppModule` NO se importa aqui arriba.
 *
 * Su decorador `@Module` llama a `ConfigModule.forRoot({ validate })` en el
 * momento de CARGAR el modulo, no al instanciarlo. Si se importara de forma
 * estatica, la validacion de configuracion correria antes de que este archivo
 * pudiera fijar `DATABASE_URL`, y la suite entera fallaria al cargarse.
 *
 * Se importa dinamicamente en `prepararApi`, despues de fijar el entorno.
 * Esto es una consecuencia real de que la configuracion se valide al arrancar
 * —que es lo correcto, ver `configuracion.ts`— y no un apano de las pruebas.
 */

/**
 * Entorno de la Puerta 2: la API real, contra Postgres real y Redis real.
 *
 * ⚠️ `DATABASE_POOL_MAX = 1` a proposito. La Puerta 2 lo exige
 * explicitamente: «Fuerza `pool.max = 1` en el test para garantizar la
 * reutilizacion». Es la unica condicion en la que P11 —el contexto de sesion
 * que se queda pegado a la conexion— se puede manifestar. Con un pool grande,
 * dos peticiones consecutivas casi nunca comparten conexion y la prueba
 * pasaria por suerte.
 */

const NOMBRE_BASE = 'paid_puerta2';
const USUARIO_APP = 'paid_prueba_api';
const CLAVE_APP = 'clave_prueba_api';

/**
 * ⚠️ El rol con el que la API se conecta es `NOSUPERUSER NOBYPASSRLS`.
 *
 * Esto NO es un detalle del entorno de pruebas: es la condicion sin la cual
 * R6 no existe. Un superusuario de PostgreSQL ignora las politicas RLS por
 * definicion, y el dueno de una tabla las ignora tambien salvo
 * `FORCE ROW LEVEL SECURITY`.
 *
 * La primera version de este arranque conectaba la API con el rol
 * administrador —el mismo que aplica las migraciones— y la prueba de fuga de
 * contexto revelo que BIM23 veia las filas de BIM24: no porque `SET LOCAL`
 * fallara, sino porque RLS no se estaba aplicando en absoluto.
 *
 * De ahi que exista tambien una prueba que comprueba explicitamente que el rol
 * de la API no es superusuario ni tiene BYPASSRLS. Es la clase de defecto que
 * convierte todo el aislamiento por unidad en decorativo sin que nada falle.
 */
const SQL_ROL_APLICACION = `
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${USUARIO_APP}') THEN
      CREATE ROLE ${USUARIO_APP} LOGIN PASSWORD '${CLAVE_APP}'
        NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    END IF;
  END
  $$;
  GRANT paid_operacion TO ${USUARIO_APP};
`;

export interface EntornoApi {
  readonly app: INestApplication;
  /** URL con la que se conecta la API: rol de aplicacion, sin privilegios. */
  readonly urlBase: string;
  /** Pool ADMINISTRADOR, para preparar datos y comprobar resultados. */
  readonly pool: Pool;
  readonly redis: Redis;
  readonly cerrar: () => Promise<void>;
}

function conBase(url: string, base: string): string {
  const u = new URL(url);
  u.pathname = `/${base}`;
  return u.toString();
}

export async function prepararApi(): Promise<EntornoApi> {
  const urlServidor = process.env['DATABASE_URL_PRUEBA'];
  if (urlServidor === undefined || urlServidor === '') {
    throw new Error(
      'Falta DATABASE_URL_PRUEBA. Ver docs/DECISIONES.md, D-14.',
    );
  }

  // Base desechable.
  const administrativo = new Client({ connectionString: conBase(urlServidor, 'postgres') });
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

  const urlAdmin = conBase(urlServidor, NOMBRE_BASE);
  const raizDb = join(__dirname, '..', '..', '..', '..', 'packages', 'db');

  // Pool administrador: migraciones, semillas y verificaciones de las pruebas.
  const pool = new Pool({ connectionString: urlAdmin, max: 2 });
  const cliente = await pool.connect();
  try {
    await aplicarPendientes(cliente, leerMigraciones(join(raizDb, 'migraciones')));
    await cliente.query(SQL_ROL_APLICACION);
    /*
     * CON las semillas de desarrollo: la Puerta 2 necesita credenciales reales
     * con clave conocida y el arbol de unidades hermanas para la prueba de
     * fuga de contexto. Es el unico sitio donde se piden a proposito.
     */
    const dirSemillas = join(raizDb, 'semillas');
    for (const archivo of archivosDeSemillas(dirSemillas, true)) {
      await cliente.query(readFileSync(join(dirSemillas, archivo), 'utf8'));
    }
  } finally {
    cliente.release();
  }

  // La URL con la que arranca la API: el rol de aplicacion, sin privilegios.
  const u = new URL(urlAdmin);
  u.username = USUARIO_APP;
  u.password = CLAVE_APP;
  const urlBase = u.toString();

  // Redis: prefijo propio para no pisar otras pruebas ni el entorno local.
  const redis = new Redis({ host: '127.0.0.1', port: 6379 });
  const claves = await redis.keys('paid:sesion:*');
  if (claves.length > 0) await redis.del(...claves);

  process.env['NODE_ENV'] = 'test';
  process.env['DATABASE_URL'] = urlBase;
  // ⚠️ La condicion de la Puerta 2: fuerza la reutilizacion de la conexion.
  process.env['DATABASE_POOL_MAX'] = '1';
  process.env['REDIS_HOST'] = '127.0.0.1';
  process.env['REDIS_PORT'] = '6379';
  process.env['SESION_TTL_SEGUNDOS'] = '600';
  process.env['SESION_AVISO_SEGUNDOS'] = '480';
  process.env['LOG_LEVEL'] = 'error';

  // Ahora si: el entorno esta fijado y la validacion de configuracion pasara.
  const { AppModule } = await import('../app.module');
  const { FiltroExcepciones } = await import('../comun/filtro-excepciones');

  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = modulo.createNestApplication();
  app.useGlobalFilters(new FiltroExcepciones());
  app.setGlobalPrefix('/api');
  await app.init();

  return {
    app,
    urlBase,
    pool,
    redis,
    cerrar: async () => {
      await app.close();
      await redis.quit().catch(() => undefined);
      await pool.end();
    },
  };
}

/** Resuelve el reto aritmetico del captcha, como haria una persona. */
export function resolverReto(textoReto: string): string {
  const suma = /^(\d+)\s*\+\s*(\d+)\s*=\s*\?$/.exec(textoReto);
  if (suma !== null) return String(Number(suma[1]) + Number(suma[2]));
  const resta = /^(\d+)\s*-\s*(\d+)\s*=\s*\?$/.exec(textoReto);
  if (resta !== null) return String(Number(resta[1]) - Number(resta[2]));
  throw new Error(`Reto de captcha no reconocido: «${textoReto}»`);
}

export const CLAVE_DESARROLLO = 'Desarrollo2026*';

import type { Config } from 'drizzle-kit';

/**
 * Migraciones versionadas y reversibles (A.1). Cada migracion generada debe
 * llevar su `down` probado (Fase 1, punto 7): drizzle-kit genera el `up`, el
 * `down` se escribe a mano en `migraciones/bajada/` y la Puerta 1 comprueba
 * que aplica y revierte limpiamente.
 */
export default {
  schema: './src/esquema/*.ts',
  out: './migraciones',
  dialect: 'postgresql',
  dbCredentials: {
    // Las migraciones corren con el usuario administrador: crean extensiones,
    // politicas RLS y disparadores, que el usuario de la aplicacion no puede.
    url: process.env['DATABASE_URL_ADMIN'] ?? '',
  },
  // Los esquemas de la PAID. `drizzle` guarda su tabla de control aparte.
  schemaFilter: ['ref', 'org', 'seg', 'ai', 'doc', 'aud', 'ia'],
  verbose: true,
  strict: true,
} satisfies Config;

import type { Config } from 'drizzle-kit';

/**
 * ⚠️ Las migraciones de este paquete se escriben A MANO en `migraciones/`, no
 * se generan desde un esquema de Drizzle. El motivo esta en
 * `migraciones/README.md` y en `docs/DECISIONES.md`, D-15: RLS, disparadores,
 * columnas generadas, privilegios revocados y la clave foranea compuesta de la
 * disyuncion de subtipo no se expresan en el DSL de Drizzle, y son justo donde
 * viven las reglas de la PAID.
 *
 * Por eso NO se debe ejecutar `drizzle-kit generate` contra esta carpeta:
 * sobreescribiria SQL que ninguna herramienta puede regenerar. El aplicador
 * propio es `src/migraciones.ts` (`pnpm db:migrate`).
 *
 * Esta configuracion se conserva para `drizzle-kit introspect` y para las
 * utilidades de comparacion, que si son utiles: permiten ver si la base y el
 * repositorio dicen lo mismo.
 */
export default {
  // El esquema Drizzle en TypeScript para la capa de consulta llega en la
  // Fase 3. Hasta entonces no hay nada que leer aqui.
  schema: './src/esquema.ts',
  out: './migraciones',
  dialect: 'postgresql',
  dbCredentials: {
    // Las migraciones corren con el usuario administrador: crean extensiones,
    // politicas RLS y disparadores, que el usuario de la aplicacion no puede.
    url: process.env['DATABASE_URL_ADMIN'] ?? '',
  },
  schemaFilter: ['ref', 'org', 'seg', 'ai', 'doc', 'aud', 'ia'],
  verbose: true,
  strict: true,
} satisfies Config;

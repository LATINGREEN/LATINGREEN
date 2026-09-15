/**
 * @paid/db — Drizzle: esquema, migraciones y semillas.
 *
 * ⛔ ESTADO: el esquema **no esta implementado**.
 *
 * PROMPT.md fija `anexo_A_ddl_paid.sql` como punto de partida de la Fase 1
 * («Completalo; no lo contradigas») y ordena: «Si falta el `.sql`, detente y
 * pidelo. No improvises el esquema.»
 *
 * Ese archivo no esta en el repositorio. Por tanto `src/esquema/` esta vacio a
 * proposito: no se ha inventado ni una tabla. Ver `docs/BITACORA.md` y
 * `docs/PREGUNTAS-JACID.md`.
 *
 * Lo que si hay es el mecanismo de contexto de sesion (R7/P11), que no depende
 * del esquema y es el anti-patron mas facil de introducir.
 */

export * from './contexto';
export * from './cliente';

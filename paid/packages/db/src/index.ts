/**
 * @paid/db — esquema, migraciones y semillas de la PAID.
 *
 * ⚠️ El esquema esta **DERIVADO de PROMPT.md**, no traducido de
 * `anexo_A_ddl_paid.sql`, que no existe. Se pregunto, como PROMPT.md ordena, y
 * se autorizo expresamente el desvio. Ver `docs/DECISIONES.md`, D-13, para lo
 * que eso implica: los nombres de columna son nuestros, el recuento de
 * catalogos de `ref` puede no coincidir con los 26 del documento, y lo que
 * ninguna regla menciona no esta.
 *
 * Los catalogos que dependen de JACID se siembran **vacios**: autorizar
 * derivar el esquema no autoriza inventar sus contenidos.
 *
 * ESTADO: esquema completo en `migraciones/` (once migraciones, todas
 * reversibles) y verificado por las 60 pruebas de la Puerta 1 contra Postgres
 * real. Lo que falta es el mapeo tipado de Drizzle para la capa de consulta,
 * que es la primera tarea de la Fase 3.
 *
 * El archivo mas delicado del paquete es `contexto.ts` (R7/P11). Leelo entero
 * antes de tocarlo.
 */

export * from './contexto';
export * from './cliente';
export * from './migraciones';
export * from './semillas';

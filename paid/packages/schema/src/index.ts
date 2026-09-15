/**
 * @paid/schema — esquemas Zod y tipos compartidos.
 *
 * Un esquema por concepto, consumido por el formulario (apps/web) y por el
 * controlador (apps/api). Si divergen, hay un error de diseno (PROMPT.md A.6).
 *
 * Lo que hay aqui son los invariantes que PROMPT.md fija de forma **literal**
 * y que por tanto no dependen de `anexo_A_ddl_paid.sql`. Los esquemas de las
 * entidades (actividad, jornada, personal, entidad A.I., herramienta AID...)
 * llegan en la Fase 1/3, cuando el DDL de referencia este disponible.
 */

export * from './primitivos';
export * from './avance';
export * from './coordenadas';
export * from './adjunto';
export * from './pestanas';
export * from './pestanas-datos';
export * from './jornada';
export * from './dominios';
export * from './errores';
export * from './autenticacion';
export * from './maestros';

import { z } from 'zod';

/**
 * Dominios cerrados que PROMPT.md enumera de forma literal. Todos ellos van a
 * tablas de catalogo del esquema `ref` (anti-patron P9: como `VARCHAR` libre,
 * «BINACIONAL» y «Binacional» cuentan como dos categorias y el consolidado del
 * RAO no cuadra).
 *
 * Aqui viven **solo** los que el PROMPT enumera. Los catalogos que dependen de
 * JACID (las 17 campanas de Q2, los atributos por tipo de herramienta de Q3)
 * NO se inventan: se siembran vacios con un TODO (Fase 1, punto 6).
 */

/** R18 — Los siete COAMI de la Reserva Naval. Relacion cero-a-muchos. */
export const COAMI = [
  'ANTIOQUIA',
  'BARRANQUILLA',
  'BOGOTA',
  'CALI',
  'CARTAGENA',
  'SAN_ANDRES',
  'SUCRE',
] as const;

export type Coami = (typeof COAMI)[number];

export const ETIQUETA_COAMI: Readonly<Record<Coami, string>> = {
  ANTIOQUIA: 'COAMI Antioquia',
  BARRANQUILLA: 'COAMI Barranquilla',
  BOGOTA: 'COAMI Bogotá',
  CALI: 'COAMI Cali',
  CARTAGENA: 'COAMI Cartagena',
  SAN_ANDRES: 'COAMI San Andrés',
  SUCRE: 'COAMI Sucre',
} as const;

/**
 * R18 — «si no hubo participacion **NO** realice seleccion». Ninguno marcado
 * por defecto. La lista vacia es un valor legitimo, no un formulario a medio
 * llenar.
 */
export const coamiParticipantes = z.array(z.enum(COAMI)).default([]);

/**
 * R9 — La ARC siempre participa.
 * En base: `participo_arc BOOLEAN NOT NULL DEFAULT TRUE CHECK (participo_arc = TRUE)`.
 * En la interfaz: marcado y **deshabilitado**.
 * El manual: «siempre se debe poner SI en ARC».
 */
export const participoArc = z.literal(true, {
  message: 'La ARC siempre participa: el valor solo puede ser verdadero (R9).',
});

/** R17 — Tipos de asistencia humanitaria. */
export const TIPOS_ASISTENCIA = ['DIRECTA', 'INDIRECTA'] as const;
export type TipoAsistencia = (typeof TIPOS_ASISTENCIA)[number];

/**
 * R17 — Si `tipo_asistencia = DIRECTA`, el plan operacional es obligatorio.
 * En base: `CHECK (id_tipo_asistencia <> DIRECTA OR id_plan_operacional IS NOT NULL)`.
 *
 * TODO(JACID): el listado completo de planes operacionales vigentes no consta.
 * PROMPT.md nombra dos (Plan San Roque II, Plan Renacer); el catalogo `ref` se
 * siembra con esos dos y un TODO, no con una lista inventada.
 */
export const PLANES_OPERACIONALES_CONOCIDOS = [
  'PLAN_SAN_ROQUE_II',
  'PLAN_RENACER',
] as const;

export const asistenciaHumanitaria = z
  .object({
    tipoAsistencia: z.enum(TIPOS_ASISTENCIA),
    idPlanOperacional: z.number().int().positive().nullable(),
  })
  .refine((v) => v.tipoAsistencia !== 'DIRECTA' || v.idPlanOperacional !== null, {
    message:
      'La asistencia humanitaria DIRECTA exige un plan operacional (por ejemplo Plan San Roque II o Plan Renacer).',
    path: ['idPlanOperacional'],
  });

/**
 * R5 — Credencial de unidad, no de persona: `<SIGLA_UNIDAD>_PAID` en
 * mayusculas. Ejemplos del manual: BIM23_PAID, COOPCM_PAID, FNP_PAID,
 * ADMIN_PAID, FUNCIONAL_PAID.
 */
export const RE_CREDENCIAL_UNIDAD = /^[A-Z0-9]{2,20}_PAID$/;

export const credencialUnidad = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => RE_CREDENCIAL_UNIDAD.test(v), {
    message: 'La credencial sigue el patron <SIGLA_UNIDAD>_PAID en mayusculas. Ejemplo: BIM23_PAID',
  });

/**
 * R4 — Mensaje de error genérico. La base distingue ocho causas para el
 * analisis forense; **la pantalla siempre dice lo mismo**.
 */
export const RESULTADOS_INTENTO_AUTENTICACION = [
  'EXITOSO',
  'CLAVE_INVALIDA',
  'USUARIO_INEXISTENTE',
  'CAPTCHA_INVALIDO',
  'USUARIO_BLOQUEADO',
  'USUARIO_INACTIVO',
  'RED_NO_AUTORIZADA',
  'CLAVE_EXPIRADA',
] as const;

export type ResultadoIntentoAutenticacion =
  (typeof RESULTADOS_INTENTO_AUTENTICACION)[number];

/**
 * Lo unico que la interfaz puede decir, sea cual sea la causa (R4). La
 * distincion vive en la base, no en la respuesta HTTP.
 */
export const MENSAJE_CREDENCIALES_INVALIDAS = 'Credenciales inválidas' as const;

/** R6 — Ambito jerarquico de datos: Fuerza -> Componente -> Unidad Tactica. */
export const NIVELES_JERARQUIA = ['FUERZA', 'COMPONENTE', 'UNIDAD_TACTICA'] as const;
export type NivelJerarquia = (typeof NIVELES_JERARQUIA)[number];

/** R2 — Tipos de red autorizada. En desarrollo se siembra 0.0.0.0/0 como ADMINISTRACION. */
export const TIPOS_RED = ['ADMINISTRACION', 'OPERACION', 'CONSULTA'] as const;
export type TipoRed = (typeof TIPOS_RED)[number];

/** R14 — Borrado logico. El fisico exige solicitud aprobada por JACID. */
export const ESTADOS_REGISTRO = ['ACTIVO', 'INACTIVO', 'ELIMINADO'] as const;
export type EstadoRegistro = (typeof ESTADOS_REGISTRO)[number];

/**
 * R8 — Los tres maestros de precedencia. Antes de registrar cualquier
 * actividad deben existir los tres. Se impone con claves foraneas
 * obligatorias, y la interfaz lo explica cuando el catalogo esta vacio.
 */
export const MAESTROS_DE_PRECEDENCIA = ['PERSONAL', 'ENTIDAD_AI', 'HERRAMIENTA_AID'] as const;
export type MaestroDePrecedencia = (typeof MAESTROS_DE_PRECEDENCIA)[number];

/** R16 — Permisos cuya atribucion esta centralizada en JACID. */
export const PERMISOS_EXCLUSIVOS_JACID = [
  'ALIANZA.AVANCE',
  'CONVENIO.CREAR',
  'CONVENIO.EDITAR',
  'NORMATIVIDAD.CARGAR',
] as const;

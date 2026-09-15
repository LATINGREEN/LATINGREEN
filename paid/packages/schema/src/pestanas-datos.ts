import { z } from 'zod';
import { cantidadEntera, decimalDigitado } from './primitivos';
import { FASES_DOCUMENTALES } from './adjunto';
import type { PestanaActividad } from './pestanas';

/**
 * R19 — Los datos de cada una de las once pestañas.
 *
 * ⚠️ TODO(JACID) Q4: de cinco de ellas —Tipo Operación, Entidades Servicios,
 * Servicios Prestados, Población Beneficiada y Entidades Apoyadas— no se
 * conocen los campos reales. Los de aquí son los mínimos que las reglas
 * permiten afirmar, y coinciden con las columnas que la migración 0007 creó.
 *
 * Por qué están todas en un MAPA y no en once controladores: las once tablas
 * hijas son estructuralmente iguales —cuelgan de una actividad, tienen su
 * catálogo y sus cantidades— y Q4 sigue sin responder. Con un mapa, responder
 * Q4 cambia una declaración; con once controladores, cambia once archivos y
 * alguno se queda atrás. Es el mismo motivo por el que `registro_completo` se
 * calcula en un solo sitio.
 */

const idCatalogo = z.coerce.number().int().positive();

/** Una cantidad que alimenta el RAO. Positiva: cero es ambiguo. */
const cantidadDeInforme = cantidadEntera.refine((v) => v > 0, {
  message:
    'La cantidad debe ser mayor que cero. Si no hubo, no registre la fila: un cero no distingue «no hubo» de «no se contó».',
});

export const datosTipoOperacion = z.object({
  idTipoOperacion: idCatalogo,
  observacion: z.string().trim().max(2000).optional(),
});

export const datosEntidadServicio = z.object({
  idEntidad: idCatalogo,
  observacion: z.string().trim().max(2000).optional(),
});

export const datosServicioPrestado = z.object({
  idServicioPrestado: idCatalogo,
  cantidad: cantidadDeInforme,
  observacion: z.string().trim().max(2000).optional(),
});

/**
 * La pestaña que alimenta el RAO, y la que un diseño anterior perdió (P2).
 *
 * TODO(JACID) Q10: no hay ninguna columna con datos personales. Si resultara
 * que hacen falta, se añaden con los controles que la Ley 1581 de 2012 exige,
 * no antes.
 */
export const datosPoblacionBeneficiada = z.object({
  idGrupoPoblacional: idCatalogo,
  cantidadPersonas: cantidadDeInforme,
  observacion: z.string().trim().max(2000).optional(),
});

export const datosEntidadApoyada = z.object({
  idEntidad: idCatalogo,
  observacion: z.string().trim().max(2000).optional(),
});

export const datosMedioDifusion = z.object({
  idMedioDifusion: idCatalogo,
  detalle: z.string().trim().max(500).optional(),
});

export const datosMedioUtilizado = z.object({
  idMedioUtilizado: idCatalogo,
  cantidad: cantidadDeInforme,
  detalle: z.string().trim().max(500).optional(),
});

export const datosRecursoUtilizado = z.object({
  idTipoRecurso: idCatalogo,
  cantidad: z.union([decimalDigitado, z.number().positive()]),
  unidadMedida: z.string().trim().max(40).optional(),
  valor: z.union([decimalDigitado, z.number().nonnegative()]).optional(),
  detalle: z.string().trim().max(500).optional(),
});

export const datosBienDonado = z.object({
  idTipoBienDonado: idCatalogo,
  descripcion: z.string().trim().min(1).max(500),
  cantidad: z.union([decimalDigitado, z.number().positive()]),
  unidadMedida: z.string().trim().max(40).optional(),
  valorEstimado: z.union([decimalDigitado, z.number().nonnegative()]).optional(),
  idEntidadDonante: idCatalogo.optional(),
});

/** Uno a uno con la actividad: es el Resumen JAD. */
export const datosResumen = z.object({
  texto: z.string().trim().min(1).max(20000),
});

/**
 * La pestaña de adjuntos NO se llena por este camino: un archivo va por
 * `multipart/form-data` a su propio endpoint, porque hay que leer su contenido
 * para comprobar el MIME real (R12) y sumar bytes para la cuota (R11).
 */
export const datosAdjunto = z.object({
  faseDocumental: z
    .number()
    .int()
    .refine((v) => (FASES_DOCUMENTALES as readonly number[]).includes(v)),
});

/** Qué pestañas se manejan como filas de datos, y con qué esquema. */
export const ESQUEMA_POR_PESTANA = {
  TIPO_OPERACION: datosTipoOperacion,
  ENTIDADES_SERVICIOS: datosEntidadServicio,
  SERVICIOS_PRESTADOS: datosServicioPrestado,
  POBLACION_BENEFICIADA: datosPoblacionBeneficiada,
  ENTIDADES_APOYADAS: datosEntidadApoyada,
  MEDIOS_DIFUSION: datosMedioDifusion,
  MEDIOS_UTILIZADOS: datosMedioUtilizado,
  RECURSOS_UTILIZADOS: datosRecursoUtilizado,
  BIENES_DONADOS: datosBienDonado,
  RESUMEN: datosResumen,
} as const;

export type PestanaConDatos = keyof typeof ESQUEMA_POR_PESTANA;

/** Las pestañas que se llenan con filas. Diez: la de adjuntos va aparte. */
export const PESTANAS_CON_DATOS = Object.keys(ESQUEMA_POR_PESTANA) as PestanaConDatos[];

export function esPestanaConDatos(valor: string): valor is PestanaConDatos {
  return Object.prototype.hasOwnProperty.call(ESQUEMA_POR_PESTANA, valor);
}

/** Comprobación en tiempo de compilación: las diez son pestañas de R19. */
const _verificacion: readonly PestanaActividad[] = PESTANAS_CON_DATOS;
void _verificacion;

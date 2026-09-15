import { z } from 'zod';

/**
 * Respuesta de error uniforme (PROMPT.md Fase 3, punto 5):
 *
 *     { codigo, mensaje, detalles?, idCorrelacion }
 *
 * El `idCorrelacion` viaja en los logs (pino + OpenTelemetry) y permite
 * rastrear una peticion de punta a punta.
 */
export const respuestaError = z.object({
  codigo: z.string(),
  mensaje: z.string(),
  detalles: z.unknown().optional(),
  idCorrelacion: z.string(),
});

export type RespuestaError = z.infer<typeof respuestaError>;

/**
 * Codigos de error del dominio. Cerrados a proposito: un codigo escrito a mano
 * en un `throw` es un codigo que nadie puede buscar.
 */
export const CODIGOS_ERROR = {
  /** R4: unico mensaje que la pantalla de ingreso puede mostrar. */
  CREDENCIALES_INVALIDAS: 'AUTH_CREDENCIALES_INVALIDAS',
  /** R1: sesion cerrada por inactividad. */
  SESION_EXPIRADA: 'AUTH_SESION_EXPIRADA',
  /** R2/R6: la peticion no procede desde una red autorizada, o fuera de ambito. */
  ACCESO_DENEGADO: 'AUTH_ACCESO_DENEGADO',
  /** R11: la cuota agregada de 10 MB de la actividad no admite el archivo. */
  CUOTA_ADJUNTOS_AGOTADA: 'ADJ_CUOTA_AGOTADA',
  /** R12: el contenido real no corresponde a la extension declarada. */
  TIPO_ARCHIVO_NO_PERMITIDO: 'ADJ_TIPO_NO_PERMITIDO',
  /** R10: tramo de avance inexistente (80, 90) o retroceso. */
  AVANCE_INVALIDO: 'AVA_TRAMO_INVALIDO',
  /** R8: falta uno de los tres maestros de precedencia. */
  MAESTRO_REQUERIDO: 'MAE_REQUERIDO',
  /** R14: el borrado fisico exige solicitud aprobada por JACID. */
  ELIMINACION_REQUIERE_SOLICITUD: 'REG_ELIMINACION_REQUIERE_SOLICITUD',
  /** Validacion de esquema Zod. */
  DATOS_INVALIDOS: 'VAL_DATOS_INVALIDOS',
  /** La ruta o el registro no existe. */
  RECURSO_NO_ENCONTRADO: 'REG_NO_ENCONTRADO',
  /** Conflicto de unicidad (por ejemplo, `codigo_actividad` repetido). */
  CONFLICTO: 'REG_CONFLICTO',
  /** IA6: el servicio de IA no respondio. NUNCA debe ser bloqueante. */
  IA_NO_DISPONIBLE: 'IA_NO_DISPONIBLE',
  INTERNO: 'ERR_INTERNO',
} as const;

export type CodigoError = (typeof CODIGOS_ERROR)[keyof typeof CODIGOS_ERROR];

/**
 * IA6 — Degradacion limpia. Aviso discreto, nunca un error bloqueante, nunca
 * una pantalla que dependa del modelo para dibujarse.
 */
export const MENSAJE_IA_NO_DISPONIBLE = 'La asistencia no está disponible' as const;

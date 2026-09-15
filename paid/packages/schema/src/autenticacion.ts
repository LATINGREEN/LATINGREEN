import { z } from 'zod';
import { credencialUnidad } from './dominios';

/**
 * Esquemas del flujo de ingreso, compartidos por el formulario y el
 * controlador (A.6).
 *
 * El flujo de PROMPT.md (Fase 2, punto 1) es:
 *
 *   reto de captcha -> validacion de red -> captcha -> credencial ->
 *   estado y vigencia -> sesion
 *
 * y cada intento escribe su causa en `seg.intento_autenticacion`, una de las
 * ocho de R4.
 */

/** Respuesta a la solicitud de un reto de captcha (R3). */
export const retoCaptcha = z.object({
  /** Identificador del reto. Viaja de vuelta en el ingreso. */
  idCaptcha: z.string(),
  /**
   * El reto para pintar en pantalla. En la base solo queda su RESUMEN: una
   * lectura de la base no puede permitir resolver un captcha pendiente.
   */
  textoReto: z.string(),
  /** Caduca a los 5 minutos (R3). Instante en UTC. */
  expiraEnUtc: z.string(),
});

export type RetoCaptcha = z.infer<typeof retoCaptcha>;

export const solicitudIngreso = z.object({
  credencial: credencialUnidad,
  clave: z.string().min(1, { message: 'La clave es obligatoria.' }),
  idCaptcha: z.string().min(1, { message: 'Falta el identificador del captcha.' }),
  respuestaCaptcha: z.string().min(1, { message: 'Resuelva el captcha.' }),
});

export type SolicitudIngreso = z.infer<typeof solicitudIngreso>;

/**
 * Respuesta de un ingreso exitoso.
 *
 * El `testigo` es opaco y viaja **una sola vez**: en la base queda solo su
 * resumen (P7). Si el cliente lo pierde, no hay forma de recuperarlo y hay que
 * volver a ingresar. Eso es lo correcto.
 */
export const respuestaIngreso = z.object({
  testigo: z.string(),
  credencial: z.string(),
  unidad: z.object({
    id: z.number().int(),
    sigla: z.string(),
    nombre: z.string(),
  }),
  roles: z.array(z.string()),
  permisos: z.array(z.string()),
  /** R1: instante de expiracion, en UTC. Deslizante. */
  expiraEnUtc: z.string(),
  /** Fase 4: a los 8 minutos se avisa y se ofrece renovar. */
  avisoEnSegundos: z.number().int().positive(),
});

export type RespuestaIngreso = z.infer<typeof respuestaIngreso>;

/**
 * R1 — Diez minutos de inactividad. Expiracion DESLIZANTE: cada peticion
 * autenticada la desplaza. Se evalua EN EL SERVIDOR.
 */
export const SESION_TTL_SEGUNDOS = 600;

/** Fase 4: aviso de expiracion a los 8 minutos, con opcion de renovar. */
export const SESION_AVISO_SEGUNDOS = 480;

/** R3 — El captcha caduca a los 5 minutos. */
export const CAPTCHA_TTL_SEGUNDOS = 300;

/** Fase 2 — Bloqueo a los 5 intentos fallidos. */
export const INTENTOS_ANTES_DE_BLOQUEO = 5;

/** Fase 2 — Historial de las ultimas 5 claves: no se pueden reutilizar. */
export const CLAVES_EN_HISTORIAL = 5;

/** Los cinco roles de PROMPT.md (Fase 2, punto 5). TODO(JACID) Q6. */
export const ROLES = [
  'ADMINISTRADOR',
  'FUNCIONAL_JACID',
  'OPERADOR_UNIDAD',
  'SUPERVISOR',
  'CONSULTA',
] as const;

export type Rol = (typeof ROLES)[number];

/** Cabecera donde viaja el testigo de sesion. */
export const CABECERA_TESTIGO = 'x-paid-testigo';

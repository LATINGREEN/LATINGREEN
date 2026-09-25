import { z } from 'zod';

/**
 * Configuracion de la API, validada al arrancar. Si falta algo, el proceso no
 * levanta: es mejor fallar en el arranque que a la tercera peticion.
 *
 * ⚠️ Los rangos de red autorizados NO estan aqui (R2). Viven en la tabla
 * `seg.red_autorizada` para que JACID pueda cambiarlos sin desplegar. Si
 * alguien anade un CIDR a este esquema, esta reintroduciendo el problema que
 * R2 describe.
 */
export const configuracion = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  API_PUERTO: z.coerce.number().int().positive().default(3000),
  API_PREFIJO: z.string().default('/api'),

  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

  /**
   * Cuantos proxies de confianza hay delante de la API. El nginx del
   * despliegue es uno; si el alojamiento pone otro delante (un VPS con su
   * propio proxy inverso), son dos. Decide que entrada de `X-Forwarded-For`
   * es la IP real del cliente: ver `seguridad/ip-origen.ts`.
   */
  PROXIES_DE_CONFIANZA: z.coerce.number().int().min(0).default(1),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),

  /** R1 — 10 minutos de inactividad, deslizantes, evaluados en servidor. */
  SESION_TTL_SEGUNDOS: z.coerce.number().int().positive().default(600),
  /** Fase 4 — aviso al usuario a los 8 minutos, con opcion de renovar. */
  SESION_AVISO_SEGUNDOS: z.coerce.number().int().positive().default(480),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  /** IA6 — apagada por defecto. La Parte A funciona igual sin ella. */
  IA_HABILITADA: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  IA_URL: z.string().default('http://localhost:8000'),
  /** Cortacircuitos con tiempo de espera corto (IA6). */
  IA_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
});

export type Configuracion = z.infer<typeof configuracion>;

export function validarConfiguracion(entorno: Record<string, unknown>): Configuracion {
  const resultado = configuracion.safeParse(entorno);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuracion invalida:\n${detalle}`);
  }
  // R1: el aviso tiene que llegar antes de que expire la sesion, o no avisa nada.
  if (resultado.data.SESION_AVISO_SEGUNDOS >= resultado.data.SESION_TTL_SEGUNDOS) {
    throw new Error(
      'SESION_AVISO_SEGUNDOS debe ser menor que SESION_TTL_SEGUNDOS: el aviso de expiracion ' +
        'tiene que llegar antes de que la sesion caduque (R1).',
    );
  }
  return resultado.data;
}

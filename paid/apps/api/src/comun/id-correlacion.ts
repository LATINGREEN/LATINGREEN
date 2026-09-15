import { randomUUID } from 'node:crypto';

/**
 * `idCorrelacion` (PROMPT.md Fase 3, punto 5): viaja en la respuesta de error
 * y en los logs, y permite rastrear una peticion de punta a punta.
 */
export const CABECERA_ID_CORRELACION = 'x-id-correlacion';

export function generarIdCorrelacion(): string {
  return randomUUID();
}

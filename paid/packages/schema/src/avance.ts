import { z } from 'zod';

/**
 * R10 — Escala de avance de proyectos sociales: OCHO tramos.
 *
 *     10, 20, 30, 40, 50, 60, 70, 100
 *
 * **NO existen 80 % ni 90 %.** El salto del 70 al 100 es deliberado: cada
 * tramo tiene su paquete documental y no hay paquete definido para esos dos.
 *
 * PROMPT.md lo senala como «el error mas facil de cometer en todo el
 * proyecto»: un diseno previo lo cometio «normalizando» la escala a diez
 * tramos. No se completa. Nunca.
 *
 * El `CHECK` de la base es literalmente `IN (10,20,30,40,50,60,70,100)`, y
 * esta constante es su espejo en TypeScript. Las dos deben decir lo mismo.
 */
export const TRAMOS_AVANCE = [10, 20, 30, 40, 50, 60, 70, 100] as const;

export type TramoAvance = (typeof TRAMOS_AVANCE)[number];

/** Tramos que NO existen, con nombre propio para que las pruebas los citen. */
export const TRAMOS_INEXISTENTES = [80, 90] as const;

export const tramoAvance = z
  .number()
  .int()
  .refine((v): v is TramoAvance => (TRAMOS_AVANCE as readonly number[]).includes(v), {
    message:
      'El avance solo admite 10, 20, 30, 40, 50, 60, 70 o 100. Los tramos 80 y 90 no existen en la escala PAID.',
  });

export function esTramoValido(valor: number): valor is TramoAvance {
  return (TRAMOS_AVANCE as readonly number[]).includes(valor);
}

/** Indice del tramo dentro de la escala, o -1 si no pertenece. */
export function indiceTramo(valor: number): number {
  return (TRAMOS_AVANCE as readonly number[]).indexOf(valor);
}

/**
 * El avance **solo progresa**: un tramo nuevo no puede ser menor que el
 * ultimo registrado (R10). Igual tampoco: repetir un tramo no es un avance,
 * es una observacion, y para eso esta el campo de observacion.
 */
export function puedeAvanzarA(tramoActual: TramoAvance | null, tramoNuevo: number): boolean {
  if (!esTramoValido(tramoNuevo)) return false;
  if (tramoActual === null) return true;
  return indiceTramo(tramoNuevo) > indiceTramo(tramoActual);
}

/**
 * Registro de un cambio de avance. Va a `ai.proyecto_avance` con fecha,
 * observacion y usuario; el manual exige actualizacion **mensual**.
 *
 * TODO(JACID)/TODO(Fase 1): los nombres definitivos de columna salen de
 * `anexo_A_ddl_paid.sql`, que aun no esta disponible. Esta forma es la del
 * PROMPT, no la del DDL.
 */
export const avanceProyecto = z.object({
  porcentajeAvance: tramoAvance,
  fechaRegistro: z.string(),
  observacion: z
    .string()
    .trim()
    .min(1, { message: 'La observacion del avance es obligatoria.' }),
});

export type AvanceProyecto = z.infer<typeof avanceProyecto>;

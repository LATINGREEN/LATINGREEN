import { z } from 'zod';

/**
 * R13 — Georreferenciacion en los SEIS formularios: jornada, asistencia,
 * rueda, proyecto, campana **y herramienta AID**.
 *
 * Se almacenan los **ocho componentes GMS** tal como los digita el usuario
 * (cuatro de latitud, cuatro de longitud). Las decimales son **columnas
 * generadas** (`GENERATED ALWAYS AS ... STORED`): no se escriben, se derivan,
 * y por eso no pueden divergir de las GMS (anti-patron P6). Ademas una columna
 * `geography(Point,4326)` con indice GiST sirve a ArcGIS.
 *
 * ⚠️ La formula de `aDecimal` es la **misma** que debe usar la columna
 * generada en SQL. Si las dos expresiones divergen, el punto del mapa deja de
 * corresponder a lo digitado — y un punto equivocado es peor que uno ausente,
 * porque parece plausible (P6).
 *
 * Expresion SQL espejo que debe llevar la migracion de la Fase 1:
 *
 *   latitud_decimal numeric(9,6) GENERATED ALWAYS AS (
 *     (latitud_grados + latitud_minutos / 60.0 + latitud_segundos / 3600.0)
 *     * CASE latitud_hemisferio WHEN 'S' THEN -1 ELSE 1 END
 *   ) STORED
 */

export const HEMISFERIOS_LATITUD = ['N', 'S'] as const;
export const HEMISFERIOS_LONGITUD = ['E', 'W'] as const;

export type HemisferioLatitud = (typeof HEMISFERIOS_LATITUD)[number];
export type HemisferioLongitud = (typeof HEMISFERIOS_LONGITUD)[number];

/** Hemisferios cuyo signo decimal es negativo. */
const HEMISFERIOS_NEGATIVOS = new Set<string>(['S', 'W']);

const grados = (maximo: number) =>
  z.number().int().min(0, { message: 'Los grados no pueden ser negativos.' }).max(maximo, {
    message: `Los grados no pueden pasar de ${maximo}. El signo lo da el hemisferio, no el numero.`,
  });

const minutos = z
  .number()
  .int()
  .min(0)
  .max(59, { message: 'Los minutos van de 0 a 59.' });

const segundos = z
  .number()
  .min(0)
  .lt(60, { message: 'Los segundos van de 0 a menos de 60.' });

export const coordenadaGms = z.object({
  latitudGrados: grados(90),
  latitudMinutos: minutos,
  latitudSegundos: segundos,
  latitudHemisferio: z.enum(HEMISFERIOS_LATITUD),
  longitudGrados: grados(180),
  longitudMinutos: minutos,
  longitudSegundos: segundos,
  longitudHemisferio: z.enum(HEMISFERIOS_LONGITUD),
});

export type CoordenadaGms = z.infer<typeof coordenadaGms>;

/**
 * Convierte un componente GMS a grados decimales.
 * Redondea a 6 decimales, que es la precision de `numeric(9,6)`: ~11 cm en el
 * ecuador, de sobra para el uso operacional, y evita que cliente y base
 * muestren cifras distintas por el ultimo bit del flotante.
 */
export function aDecimal(
  gradosValor: number,
  minutosValor: number,
  segundosValor: number,
  hemisferio: string,
): number {
  const magnitud = gradosValor + minutosValor / 60 + segundosValor / 3600;
  const signo = HEMISFERIOS_NEGATIVOS.has(hemisferio) ? -1 : 1;
  return Number((magnitud * signo).toFixed(6));
}

export interface CoordenadaDecimal {
  readonly latitud: number;
  readonly longitud: number;
}

/** Las dos decimales derivadas de los ocho componentes GMS. */
export function gmsADecimales(c: CoordenadaGms): CoordenadaDecimal {
  return {
    latitud: aDecimal(
      c.latitudGrados,
      c.latitudMinutos,
      c.latitudSegundos,
      c.latitudHemisferio,
    ),
    longitud: aDecimal(
      c.longitudGrados,
      c.longitudMinutos,
      c.longitudSegundos,
      c.longitudHemisferio,
    ),
  };
}

/**
 * Caja envolvente aproximada del territorio colombiano (continental e
 * insular, incluido el archipielago de San Andres y Providencia).
 *
 * No es una validacion bloqueante: es un **aviso**. Una coordenada fuera de
 * Colombia puede ser legitima (comision en el exterior, ejercicio binacional)
 * y bloquearla seria peor que advertirla. Pero un dedazo en los grados
 * tampoco debe pasar inadvertido.
 */
export const CAJA_COLOMBIA = {
  latitudMinima: -4.3,
  latitudMaxima: 13.6,
  longitudMinima: -82.0,
  longitudMaxima: -66.8,
} as const;

export function estaEnColombia(punto: CoordenadaDecimal): boolean {
  return (
    punto.latitud >= CAJA_COLOMBIA.latitudMinima &&
    punto.latitud <= CAJA_COLOMBIA.latitudMaxima &&
    punto.longitud >= CAJA_COLOMBIA.longitudMinima &&
    punto.longitud <= CAJA_COLOMBIA.longitudMaxima
  );
}

/** Formato de presentacion: 10° 23' 45.5" N */
export function formatearGms(
  gradosValor: number,
  minutosValor: number,
  segundosValor: number,
  hemisferio: string,
): string {
  return `${gradosValor}° ${minutosValor}' ${segundosValor}" ${hemisferio}`;
}

/**
 * Los seis formularios que capturan georreferenciacion (R13). Se declara como
 * dominio cerrado para que la Fase 1 y la Fase 3 no se dejen ninguno: el
 * olvido tipico es «herramienta AID», que no es una actividad.
 */
export const FORMULARIOS_CON_GEORREFERENCIA = [
  'JORNADA_APOYO',
  'ASISTENCIA_HUMANITARIA',
  'RUEDA_SERVICIOS',
  'PROYECTO_SOCIAL',
  'CAMPANA',
  'HERRAMIENTA_AID',
] as const;

export type FormularioConGeorreferencia = (typeof FORMULARIOS_CON_GEORREFERENCIA)[number];

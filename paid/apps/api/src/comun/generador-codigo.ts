import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';

/**
 * ⚠️ TODO(JACID) Q1 — El algoritmo exacto del `codigo_actividad` NO SE CONOCE.
 *
 * Ejemplos observados en los registros existentes:
 *
 *   2813304R102021R6HXZ    unidad 2813304, R, mes 10, año 2021, sufijo R6HXZ
 *   6114022R22022DPKAZ     unidad 6114022, R, mes  2, año 2022, sufijo DPKAZ
 *   1111853R82022JCTLR
 *   2510444R102021JVRTP
 *   6102320R22022RT4HZ
 *   22121854R72021MANPP    ← ocho digitos de unidad, no siete
 *
 * Lo que no se sabe (ver docs/PREGUNTAS-JACID.md, Q1):
 *
 *   - si el primer bloque es el codigo de la unidad, y de que catalogo sale;
 *   - que significa la letra `R`;
 *   - **si los cinco caracteres finales codifican algo** (tipo de actividad,
 *     consecutivo, iniciales del responsable) o son aleatorios;
 *   - si lo genera el sistema o lo digita el usuario.
 *
 * El tercero es el que importa: si esos cinco caracteres significan algo y el
 * sistema los genera al azar, **esa informacion se pierde para siempre en cada
 * actividad nueva**. De ahi que esto sea una interfaz y no una funcion: cuando
 * llegue la respuesta, se sustituye la implementacion y no el modulo.
 */
export interface GeneradorCodigo {
  /**
   * Genera un candidato. Puede colisionar: la unicidad la garantiza la
   * restriccion `UNIQUE` de la base y el reintento de quien llama.
   */
  generar(datos: { codigoUnidad: string; fecha: Date }): string;
  /** Cuantas veces conviene reintentar ante colision. */
  readonly reintentos: number;
}

/** Los caracteres del sufijo observado: mayusculas y digitos. */
const ALFABETO_SUFIJO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const LONGITUD_SUFIJO = 5;

/**
 * Implementacion del patron OBSERVADO. No es el algoritmo real.
 *
 * `<codigo de unidad>R<mes sin cero inicial><año><sufijo de 5>`
 */
@Injectable()
export class GeneradorCodigoObservado implements GeneradorCodigo {
  readonly reintentos = 5;

  generar(datos: { codigoUnidad: string; fecha: Date }): string {
    // El mes va sin cero inicial: en los ejemplos aparece `R2` y no `R02`.
    const mes = datos.fecha.getUTCMonth() + 1;
    const anio = datos.fecha.getUTCFullYear();

    let sufijo = '';
    for (let i = 0; i < LONGITUD_SUFIJO; i += 1) {
      sufijo += ALFABETO_SUFIJO[randomInt(0, ALFABETO_SUFIJO.length)];
    }

    return `${datos.codigoUnidad}R${mes}${anio}${sufijo}`;
  }
}

/** Para que la Fase 3 pueda comprobar la forma sin fijar el algoritmo. */
export const RE_CODIGO_OBSERVADO = /^[0-9A-Z]+R(1[0-2]|[1-9])\d{4}[A-Z0-9]{5}$/;

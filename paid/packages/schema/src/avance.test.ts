import { describe, expect, it } from 'vitest';
import {
  TRAMOS_AVANCE,
  TRAMOS_INEXISTENTES,
  esTramoValido,
  puedeAvanzarA,
  tramoAvance,
} from './avance';

/**
 * R10 es, segun PROMPT.md, «el error mas facil de cometer en todo el
 * proyecto». Estas pruebas existen para que completar la escala a diez tramos
 * rompa la compilacion de la suite, no para documentar la escala.
 */
describe('R10 — escala de avance de ocho tramos', () => {
  it('tiene exactamente ocho tramos', () => {
    expect(TRAMOS_AVANCE).toHaveLength(8);
  });

  it('es literalmente 10,20,30,40,50,60,70,100', () => {
    expect([...TRAMOS_AVANCE]).toEqual([10, 20, 30, 40, 50, 60, 70, 100]);
  });

  it.each([...TRAMOS_AVANCE])('acepta el tramo %i', (tramo) => {
    expect(tramoAvance.safeParse(tramo).success).toBe(true);
    expect(esTramoValido(tramo)).toBe(true);
  });

  it.each([...TRAMOS_INEXISTENTES])('RECHAZA el tramo %i, que no existe', (tramo) => {
    expect(tramoAvance.safeParse(tramo).success).toBe(false);
    expect(esTramoValido(tramo)).toBe(false);
  });

  it('rechaza 0, 5, 75, 99 y 101', () => {
    for (const invalido of [0, 5, 75, 99, 101]) {
      expect(tramoAvance.safeParse(invalido).success).toBe(false);
    }
  });

  it('no admite decimales', () => {
    expect(tramoAvance.safeParse(70.5).success).toBe(false);
  });

  it('salta del 70 al 100 sin pasar por 80 ni 90', () => {
    const indice70 = TRAMOS_AVANCE.indexOf(70);
    expect(TRAMOS_AVANCE[indice70 + 1]).toBe(100);
  });
});

describe('R10 — el avance solo progresa', () => {
  it('desde nada admite cualquier tramo valido', () => {
    expect(puedeAvanzarA(null, 10)).toBe(true);
    expect(puedeAvanzarA(null, 100)).toBe(true);
  });

  it('admite subir al tramo siguiente', () => {
    expect(puedeAvanzarA(60, 70)).toBe(true);
    expect(puedeAvanzarA(70, 100)).toBe(true);
  });

  it('admite saltarse tramos hacia arriba', () => {
    expect(puedeAvanzarA(10, 70)).toBe(true);
  });

  it('rechaza retroceder', () => {
    expect(puedeAvanzarA(70, 60)).toBe(false);
    expect(puedeAvanzarA(100, 10)).toBe(false);
  });

  it('rechaza repetir el mismo tramo: repetir no es avanzar', () => {
    expect(puedeAvanzarA(50, 50)).toBe(false);
  });

  it('rechaza avanzar a un tramo inexistente aunque sea mayor', () => {
    expect(puedeAvanzarA(70, 80)).toBe(false);
    expect(puedeAvanzarA(70, 90)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { crearJornada } from './jornada';

/**
 * Los datos generales que el Manual del Usuario pide en las láminas 20 y 21
 * (migración 0015): tipo de jornada, participación de EJC y FAC, y si la
 * población es afecta a la tropa.
 */
const BASE = {
  latitudGrados: 1,
  latitudMinutos: 47,
  latitudSegundos: 30,
  latitudHemisferio: 'N',
  longitudGrados: 78,
  longitudMinutos: 48,
  longitudSegundos: 45,
  longitudHemisferio: 'W',
  descripcion: 'Jornada de apoyo al desarrollo.',
  fechaInicio: '02/03/2026',
  fechaEjecucion: '05/03/2026',
  lugar: 'Vereda La Playa',
  idTipoJornada: 1,
  participoEjc: false,
  participoFac: false,
  poblacionAfectaTropa: true,
  coami: [],
};

function mensajeDe(entrada: unknown, campo: string): string | undefined {
  const r = crearJornada.safeParse(entrada);
  if (r.success) return undefined;
  return r.error.issues.find((i) => i.path[0] === campo)?.message;
}

describe('crearJornada — campos del manual (láminas 20–21)', () => {
  it('acepta una jornada con los cuatro', () => {
    expect(crearJornada.safeParse(BASE).success).toBe(true);
  });

  it.each([
    ['idTipoJornada', 'Elija el tipo de jornada.'],
    ['participoEjc', 'Indique si participó el Ejército (EJC).'],
    ['participoFac', 'Indique si participó la Fuerza Aérea (FAC).'],
    ['poblacionAfectaTropa', 'Indique si la población es afecta a la tropa.'],
  ])('sin %s, lo pide con palabras', (campo, mensaje) => {
    const { [campo as keyof typeof BASE]: _omitido, ...sinCampo } = BASE;
    expect(mensajeDe(sinCampo, campo)).toBe(mensaje);
  });

  it('un tipo de jornada vacío en el formulario no pasa como 0', () => {
    // Number('') es 0: sin `positive()` un desplegable sin elegir llegaría a
    // la base como un identificador.
    expect(mensajeDe({ ...BASE, idTipoJornada: '' }, 'idTipoJornada')).toBe(
      'Elija el tipo de jornada.',
    );
  });

  it('un «No» en texto NO se convierte en «Sí»', () => {
    // Con z.coerce.boolean(), 'false' sería true: toda cadena no vacía lo es.
    expect(crearJornada.safeParse({ ...BASE, participoEjc: 'false' }).success).toBe(false);
  });

  it('«No» es un valor válido, distinto de no responder', () => {
    const r = crearJornada.parse({ ...BASE, participoEjc: false });
    expect(r.participoEjc).toBe(false);
  });
});

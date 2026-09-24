import { describe, expect, it } from 'vitest';
import { crearHerramienta } from './maestros';
import { hoyEnBogota } from './primitivos';

/** Lámina 46 del Manual del Usuario (migración 0016). */
const BASE = {
  latitudGrados: 1,
  latitudMinutos: 47,
  latitudSegundos: 30,
  latitudHemisferio: 'N',
  longitudGrados: 78,
  longitudMinutos: 48,
  longitudSegundos: 45,
  longitudHemisferio: 'W',
  idTipoHerramientaAid: 1,
  codigo: 'HAID-001',
  nombre: 'Emisora Bahía',
  idEstadoHerramienta: 1,
  fechaPotenciacion: '10/02/2026',
  idPersonalResponsable: 3,
};

function mensajeDe(entrada: unknown, campo: string): string | undefined {
  const r = crearHerramienta.safeParse(entrada);
  if (r.success) return undefined;
  return r.error.issues.find((i) => i.path[0] === campo)?.message;
}

describe('crearHerramienta — campos del manual (lámina 46)', () => {
  it('acepta una herramienta completa', () => {
    expect(crearHerramienta.safeParse(BASE).success).toBe(true);
  });

  it.each([
    ['idEstadoHerramienta', 'Elija el estado de la herramienta.'],
    ['idPersonalResponsable', 'Elija el responsable de la herramienta.'],
    ['idTipoHerramientaAid', 'Elija el tipo de herramienta.'],
  ])('sin %s, lo pide con palabras', (campo, mensaje) => {
    const { [campo as keyof typeof BASE]: _omitido, ...sinCampo } = BASE;
    expect(mensajeDe(sinCampo, campo)).toBe(mensaje);
  });

  it('la fecha de potenciación es obligatoria', () => {
    const { fechaPotenciacion: _f, ...sinFecha } = BASE;
    expect(mensajeDe(sinFecha, 'fechaPotenciacion')).toBeDefined();
  });

  it('una fecha de potenciación futura se rechaza; la de hoy no', () => {
    expect(mensajeDe({ ...BASE, fechaPotenciacion: '01/01/2999' }, 'fechaPotenciacion')).toBe(
      'La fecha de potenciación no puede ser posterior a hoy.',
    );
    expect(crearHerramienta.safeParse({ ...BASE, fechaPotenciacion: hoyEnBogota() }).success).toBe(
      true,
    );
  });

  it('la fecha de registro ya no se pide: la pone la base', () => {
    const r = crearHerramienta.parse({ ...BASE, fechaRegistro: '10/02/2026' });
    expect('fechaRegistro' in r).toBe(false);
  });
});

describe('hoyEnBogota', () => {
  it('tiene la forma aaaa-mm-dd', () => {
    expect(hoyEnBogota()).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  });
});

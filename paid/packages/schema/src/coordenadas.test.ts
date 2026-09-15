import { describe, expect, it } from 'vitest';
import {
  FORMULARIOS_CON_GEORREFERENCIA,
  aDecimal,
  coordenadaGms,
  estaEnColombia,
  gmsADecimales,
} from './coordenadas';

describe('R13 — conversion GMS a decimales', () => {
  it('convierte el caso trivial', () => {
    expect(aDecimal(10, 0, 0, 'N')).toBe(10);
  });

  it('suma minutos y segundos', () => {
    // 10° 30' 36" = 10 + 0.5 + 0.01 = 10.51
    expect(aDecimal(10, 30, 36, 'N')).toBe(10.51);
  });

  it('el hemisferio S da signo negativo', () => {
    expect(aDecimal(4, 12, 0, 'S')).toBe(-4.2);
  });

  it('el hemisferio W da signo negativo', () => {
    expect(aDecimal(75, 30, 0, 'W')).toBe(-75.5);
  });

  it('los grados nunca llevan el signo: lo da el hemisferio', () => {
    const conGradoNegativo = coordenadaGms.safeParse({
      latitudGrados: -10,
      latitudMinutos: 0,
      latitudSegundos: 0,
      latitudHemisferio: 'N',
      longitudGrados: 75,
      longitudMinutos: 0,
      longitudSegundos: 0,
      longitudHemisferio: 'W',
    });
    expect(conGradoNegativo.success).toBe(false);
  });

  it('redondea a seis decimales, la precision de numeric(9,6)', () => {
    expect(aDecimal(10, 23, 45.5, 'N')).toBe(10.395972);
  });

  it('Cartagena de Indias cae dentro de Colombia', () => {
    // 10° 23' 27" N, 75° 30' 51" W
    const punto = gmsADecimales(
      coordenadaGms.parse({
        latitudGrados: 10,
        latitudMinutos: 23,
        latitudSegundos: 27,
        latitudHemisferio: 'N',
        longitudGrados: 75,
        longitudMinutos: 30,
        longitudSegundos: 51,
        longitudHemisferio: 'W',
      }),
    );
    expect(punto.latitud).toBeCloseTo(10.3908, 3);
    expect(punto.longitud).toBeCloseTo(-75.5142, 3);
    expect(estaEnColombia(punto)).toBe(true);
  });

  it('Leticia, en el sur, tambien cae dentro', () => {
    // 4° 12' 55" S, 69° 56' 26" W
    const punto = gmsADecimales(
      coordenadaGms.parse({
        latitudGrados: 4,
        latitudMinutos: 12,
        latitudSegundos: 55,
        latitudHemisferio: 'S',
        longitudGrados: 69,
        longitudMinutos: 56,
        longitudSegundos: 26,
        longitudHemisferio: 'W',
      }),
    );
    expect(punto.latitud).toBeLessThan(0);
    expect(estaEnColombia(punto)).toBe(true);
  });

  it('Madrid queda fuera de Colombia, pero la coordenada es valida', () => {
    const punto = gmsADecimales(
      coordenadaGms.parse({
        latitudGrados: 40,
        latitudMinutos: 25,
        latitudSegundos: 0,
        latitudHemisferio: 'N',
        longitudGrados: 3,
        longitudMinutos: 42,
        longitudSegundos: 0,
        longitudHemisferio: 'W',
      }),
    );
    expect(estaEnColombia(punto)).toBe(false);
  });

  it('rechaza minutos de 60 y segundos de 60', () => {
    const base = {
      latitudGrados: 10,
      latitudMinutos: 0,
      latitudSegundos: 0,
      latitudHemisferio: 'N',
      longitudGrados: 75,
      longitudMinutos: 0,
      longitudSegundos: 0,
      longitudHemisferio: 'W',
    };
    expect(coordenadaGms.safeParse({ ...base, latitudMinutos: 60 }).success).toBe(false);
    expect(coordenadaGms.safeParse({ ...base, latitudSegundos: 60 }).success).toBe(false);
  });

  it('rechaza latitud sobre 90 y longitud sobre 180', () => {
    const base = {
      latitudGrados: 91,
      latitudMinutos: 0,
      latitudSegundos: 0,
      latitudHemisferio: 'N',
      longitudGrados: 181,
      longitudMinutos: 0,
      longitudSegundos: 0,
      longitudHemisferio: 'W',
    };
    expect(coordenadaGms.safeParse(base).success).toBe(false);
  });

  it('rechaza un hemisferio de longitud usado como latitud', () => {
    const r = coordenadaGms.safeParse({
      latitudGrados: 10,
      latitudMinutos: 0,
      latitudSegundos: 0,
      latitudHemisferio: 'W',
      longitudGrados: 75,
      longitudMinutos: 0,
      longitudSegundos: 0,
      longitudHemisferio: 'W',
    });
    expect(r.success).toBe(false);
  });
});

describe('R13 — los SEIS formularios con georreferenciacion', () => {
  it('son seis', () => {
    expect(FORMULARIOS_CON_GEORREFERENCIA).toHaveLength(6);
  });

  it('incluye herramienta AID, que es el que se olvida', () => {
    expect(FORMULARIOS_CON_GEORREFERENCIA).toContain('HERRAMIENTA_AID');
  });
});

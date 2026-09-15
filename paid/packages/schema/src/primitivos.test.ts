import { describe, expect, it } from 'vitest';
import {
  ZONA_HORARIA_PRESENTACION,
  decimalDigitado,
  fechaDdMmAaaa,
  formatearFechaDdMmAaaa,
  normalizarTexto,
} from './primitivos';

describe('A.2.4 — separador decimal punto', () => {
  it('acepta el punto', () => {
    expect(decimalDigitado.parse('1234.56')).toBe(1234.56);
    expect(decimalDigitado.parse('7')).toBe(7);
  });

  it('RECHAZA la coma en lugar de interpretarla: 1,234 es ambiguo', () => {
    const r = decimalDigitado.safeParse('1,234');
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toContain('punto');
    }
  });

  it('rechaza texto y numeros a medias', () => {
    for (const malo of ['', 'abc', '12.', '.5', '1.2.3', '12 34']) {
      expect(decimalDigitado.safeParse(malo).success).toBe(false);
    }
  });
});

describe('A.2.4/A.2.5 — fecha dd/mm/aaaa a DATE', () => {
  it('normaliza a aaaa-mm-dd, sin componente horario', () => {
    expect(fechaDdMmAaaa.parse('05/03/2026')).toBe('2026-03-05');
  });

  it('no desplaza el dia: el 01/01 sigue siendo el 01/01', () => {
    expect(fechaDdMmAaaa.parse('01/01/2026')).toBe('2026-01-01');
  });

  it('acepta el 29 de febrero de un ano bisiesto', () => {
    expect(fechaDdMmAaaa.parse('29/02/2024')).toBe('2024-02-29');
  });

  it('rechaza el 29 de febrero de un ano no bisiesto', () => {
    expect(fechaDdMmAaaa.safeParse('29/02/2025').success).toBe(false);
  });

  it('rechaza el 31 de abril y el mes 13', () => {
    expect(fechaDdMmAaaa.safeParse('31/04/2026').success).toBe(false);
    expect(fechaDdMmAaaa.safeParse('01/13/2026').success).toBe(false);
  });

  it('rechaza el formato estadounidense y el ISO en el formulario', () => {
    expect(fechaDdMmAaaa.safeParse('2026-03-05').success).toBe(false);
    expect(fechaDdMmAaaa.safeParse('3/5/2026').success).toBe(false);
  });

  it('vuelve a dd/mm/aaaa para presentacion', () => {
    expect(formatearFechaDdMmAaaa('2026-03-05')).toBe('05/03/2026');
  });

  it('presenta en America/Bogota', () => {
    expect(ZONA_HORARIA_PRESENTACION).toBe('America/Bogota');
  });
});

describe('normalizacion de texto para deduplicacion (base de pg_trgm y de U3)', () => {
  it('quita tildes y pasa a mayusculas', () => {
    expect(normalizarTexto('Fundación El Futuro')).toBe('FUNDACION EL FUTURO');
  });

  it('colapsa espacios', () => {
    expect(normalizarTexto('  FUNDACION   EL  FUTURO  ')).toBe('FUNDACION EL FUTURO');
  });

  it('hace comparables «BINACIONAL» y «Binacional», el caso de P9', () => {
    expect(normalizarTexto('Binacional')).toBe(normalizarTexto('BINACIONAL'));
  });

  it('conserva la ene como N, coherente con «sin tildes ni enes» de A.6', () => {
    expect(normalizarTexto('Compañía')).toBe('COMPANIA');
  });
});

import { describe, expect, it } from 'vitest';
import {
  CANTIDAD_PESTANAS,
  ETIQUETA_PESTANA,
  PESTANAS_ACTIVIDAD,
  PESTANA_QUE_ALIMENTA_EL_RAO,
  evaluarPestanas,
} from './pestanas';

describe('R19 — las once pestanas', () => {
  it('son once', () => {
    expect(PESTANAS_ACTIVIDAD).toHaveLength(CANTIDAD_PESTANAS);
    expect(CANTIDAD_PESTANAS).toBe(11);
  });

  it('estan en el orden del manual', () => {
    expect([...PESTANAS_ACTIVIDAD]).toEqual([
      'TIPO_OPERACION',
      'ARCHIVOS_ADJUNTOS',
      'ENTIDADES_SERVICIOS',
      'SERVICIOS_PRESTADOS',
      'POBLACION_BENEFICIADA',
      'ENTIDADES_APOYADAS',
      'MEDIOS_DIFUSION',
      'MEDIOS_UTILIZADOS',
      'RECURSOS_UTILIZADOS',
      'BIENES_DONADOS',
      'RESUMEN',
    ]);
  });

  it('incluye poblacion beneficiada, la que el diseno auditado perdio (P2)', () => {
    expect(PESTANAS_ACTIVIDAD).toContain(PESTANA_QUE_ALIMENTA_EL_RAO);
    expect(PESTANA_QUE_ALIMENTA_EL_RAO).toBe('POBLACION_BENEFICIADA');
  });

  it('cada pestana tiene su etiqueta para la interfaz', () => {
    for (const pestana of PESTANAS_ACTIVIDAD) {
      expect(ETIQUETA_PESTANA[pestana]).toBeTruthy();
    }
  });
});

describe('R19 — registro_completo', () => {
  it('es falso mientras falte una sola pestana', () => {
    const sinResumen = PESTANAS_ACTIVIDAD.filter((p) => p !== 'RESUMEN');
    const estado = evaluarPestanas(sinResumen);
    expect(estado.registroCompleto).toBe(false);
    expect(estado.faltantes).toEqual(['RESUMEN']);
  });

  it('es verdadero solo con las once', () => {
    const estado = evaluarPestanas(PESTANAS_ACTIVIDAD);
    expect(estado.registroCompleto).toBe(true);
    expect(estado.faltantes).toHaveLength(0);
  });

  it('una actividad recien creada no esta completa', () => {
    const estado = evaluarPestanas([]);
    expect(estado.registroCompleto).toBe(false);
    expect(estado.faltantes).toHaveLength(11);
  });

  it('senala exactamente que falta, para que el listado lo pueda pintar', () => {
    const estado = evaluarPestanas(['TIPO_OPERACION', 'RESUMEN']);
    expect(estado.completas).toEqual(['TIPO_OPERACION', 'RESUMEN']);
    expect(estado.faltantes).toHaveLength(9);
  });
});

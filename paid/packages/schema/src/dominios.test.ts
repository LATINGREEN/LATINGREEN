import { describe, expect, it } from 'vitest';
import {
  COAMI,
  MENSAJE_CREDENCIALES_INVALIDAS,
  RESULTADOS_INTENTO_AUTENTICACION,
  asistenciaHumanitaria,
  coamiParticipantes,
  credencialUnidad,
  participoArc,
} from './dominios';

describe('R9 — la ARC siempre participa', () => {
  it('acepta verdadero', () => {
    expect(participoArc.safeParse(true).success).toBe(true);
  });

  it('RECHAZA falso (es el caso de la Puerta 1)', () => {
    expect(participoArc.safeParse(false).success).toBe(false);
  });
});

describe('R18 — los siete COAMI, opcionales', () => {
  it('son siete', () => {
    expect(COAMI).toHaveLength(7);
  });

  it('son ANTIOQUIA, BARRANQUILLA, BOGOTA, CALI, CARTAGENA, SAN_ANDRES, SUCRE', () => {
    expect([...COAMI]).toEqual([
      'ANTIOQUIA',
      'BARRANQUILLA',
      'BOGOTA',
      'CALI',
      'CARTAGENA',
      'SAN_ANDRES',
      'SUCRE',
    ]);
  });

  it('por defecto NO marca ninguno: «si no hubo participacion NO realice seleccion»', () => {
    expect(coamiParticipantes.parse(undefined)).toEqual([]);
  });

  it('la lista vacia es un valor legitimo, no un formulario incompleto', () => {
    expect(coamiParticipantes.safeParse([]).success).toBe(true);
  });

  it('rechaza un COAMI que no existe', () => {
    expect(coamiParticipantes.safeParse(['MEDELLIN']).success).toBe(false);
  });
});

describe('R17 — asistencia DIRECTA exige plan operacional', () => {
  it('DIRECTA sin plan es RECHAZADA', () => {
    const r = asistenciaHumanitaria.safeParse({
      tipoAsistencia: 'DIRECTA',
      idPlanOperacional: null,
    });
    expect(r.success).toBe(false);
  });

  it('DIRECTA con plan es aceptada', () => {
    expect(
      asistenciaHumanitaria.safeParse({ tipoAsistencia: 'DIRECTA', idPlanOperacional: 1 })
        .success,
    ).toBe(true);
  });

  it('INDIRECTA sin plan es aceptada', () => {
    expect(
      asistenciaHumanitaria.safeParse({
        tipoAsistencia: 'INDIRECTA',
        idPlanOperacional: null,
      }).success,
    ).toBe(true);
  });
});

describe('R5 — credencial de unidad, no de persona', () => {
  it.each(['BIM23_PAID', 'COOPCM_PAID', 'FNP_PAID', 'ADMIN_PAID', 'FUNCIONAL_PAID'])(
    'acepta %s',
    (credencial) => {
      expect(credencialUnidad.safeParse(credencial).success).toBe(true);
    },
  );

  it('normaliza a mayusculas', () => {
    expect(credencialUnidad.parse('bim23_paid')).toBe('BIM23_PAID');
  });

  it('rechaza credenciales sin el sufijo _PAID', () => {
    for (const malo of ['BIM23', 'BIM23_PAIDX', 'BIM23-PAID', 'juan.perez', '_PAID']) {
      expect(credencialUnidad.safeParse(malo).success).toBe(false);
    }
  });
});

describe('R4 — ocho causas en la base, un solo mensaje en la pantalla', () => {
  it('la base distingue ocho resultados', () => {
    expect(RESULTADOS_INTENTO_AUTENTICACION).toHaveLength(8);
  });

  it('la pantalla solo dice «Credenciales invalidas»', () => {
    expect(MENSAJE_CREDENCIALES_INVALIDAS).toBe('Credenciales inválidas');
  });

  it('el mensaje de pantalla no nombra ninguna de las ocho causas', () => {
    for (const causa of RESULTADOS_INTENTO_AUTENTICACION) {
      expect(MENSAJE_CREDENCIALES_INVALIDAS.toUpperCase()).not.toContain(causa);
    }
  });
});

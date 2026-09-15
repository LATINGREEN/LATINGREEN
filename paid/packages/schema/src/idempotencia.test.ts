import { describe, expect, it } from 'vitest';
import { crearHerramienta, crearPersonal, crearEntidad } from './maestros';
import { actualizarJornada, crearJornada } from './jornada';
import { ESQUEMA_POR_PESTANA } from './pestanas-datos';
import { fechaDdMmAaaa } from './primitivos';

/**
 * ⚠️ IDEMPOTENCIA DE LOS ESQUEMAS QUE CRUZAN LA RED.
 *
 * A.6 exige un solo esquema Zod para cliente y servidor. La consecuencia que
 * no es obvia: ese esquema se ejecuta DOS VECES sobre el mismo dato. El
 * formulario valida y envía la salida; el controlador vuelve a validar esa
 * salida. Si el esquema transforma y no admite su propia salida, la segunda
 * pasada rechaza lo que la primera aceptó.
 *
 * Pasó, y la Puerta 4 lo encontró: `fechaDdMmAaaa` normalizaba `02/03/2026` a
 * `2026-03-02`, el formulario enviaba eso, y el controlador respondía «No se
 * pudo registrar la jornada» sin decir por qué. El formulario de jornadas no
 * había guardado nunca por la interfaz.
 *
 * Estas pruebas fijan la propiedad: `esquema.parse(esquema.parse(x))` tiene
 * que dar lo mismo que `esquema.parse(x)`. Quien añada una transformación a un
 * esquema compartido las verá fallar.
 */

function esIdempotente(esquema: { parse: (v: unknown) => unknown }, entrada: unknown): void {
  const primera = esquema.parse(entrada);
  const segunda = esquema.parse(primera);
  expect(segunda).toEqual(primera);
}

const GMS = {
  latitudGrados: 1,
  latitudMinutos: 47,
  latitudSegundos: 30,
  latitudHemisferio: 'N',
  longitudGrados: 78,
  longitudMinutos: 48,
  longitudSegundos: 45,
  longitudHemisferio: 'W',
};

describe('fechaDdMmAaaa', () => {
  it('normaliza dd/mm/aaaa a aaaa-mm-dd', () => {
    expect(fechaDdMmAaaa.parse('05/03/2026')).toBe('2026-03-05');
  });

  it('admite su propia salida, y no la cambia', () => {
    expect(fechaDdMmAaaa.parse('2026-03-05')).toBe('2026-03-05');
    esIdempotente(fechaDdMmAaaa, '05/03/2026');
  });

  it('sigue rechazando una fecha que no existe, en las dos formas', () => {
    expect(fechaDdMmAaaa.safeParse('31/02/2026').success).toBe(false);
    expect(fechaDdMmAaaa.safeParse('2026-02-31').success).toBe(false);
  });

  it('sigue rechazando lo que no es ninguna de las dos formas', () => {
    for (const malo of ['5/3/2026', '2026/03/05', '03-05-2026', 'ayer', '']) {
      expect(fechaDdMmAaaa.safeParse(malo).success, malo).toBe(false);
    }
  });
});

describe('esquemas que cruzan la red', () => {
  it('crearJornada es idempotente', () => {
    esIdempotente(crearJornada, {
      ...GMS,
      descripcion: 'Jornada de apoyo al desarrollo.',
      fechaInicio: '02/03/2026',
      fechaEjecucion: '05/03/2026',
      lugar: 'Vereda La Playa',
      coami: [],
    });
  });

  it('actualizarJornada es idempotente', () => {
    esIdempotente(actualizarJornada, { lugar: 'Otro lugar', fechaEjecucion: '05/03/2026' });
  });

  it('crearHerramienta es idempotente', () => {
    esIdempotente(crearHerramienta, {
      ...GMS,
      idTipoHerramientaAid: 1,
      codigo: 'HAID-001',
      nombre: 'Unidad médica fluvial',
      fechaRegistro: '10/02/2026',
    });
  });

  it('crearPersonal es idempotente', () => {
    esIdempotente(crearPersonal, {
      idTipoDocumentoIdentidad: 1,
      numeroDocumento: '1030512345',
      nombres: 'Andrés Felipe',
      apellidos: 'Mosquera Rentería',
    });
  });

  it('crearEntidad es idempotente', () => {
    esIdempotente(crearEntidad, {
      idTipoEntidad: 1,
      nombre: 'Alcaldía Municipal de San Andrés de Tumaco',
    });
  });

  /**
   * Las diez pestañas de datos, con el mínimo que cada esquema exige. Se
   * recorren desde `ESQUEMA_POR_PESTANA` y no una a una: cuando Q4 se
   * responda y los campos cambien, esta prueba sigue cubriéndolas.
   */
  const MINIMOS: Readonly<Record<string, Record<string, unknown>>> = {
    TIPO_OPERACION: { idTipoOperacion: 1 },
    ENTIDADES_SERVICIOS: { idEntidad: 1 },
    SERVICIOS_PRESTADOS: { idServicioPrestado: 1, cantidad: 3 },
    POBLACION_BENEFICIADA: { idGrupoPoblacional: 1, cantidadPersonas: 120 },
    ENTIDADES_APOYADAS: { idEntidad: 1 },
    MEDIOS_DIFUSION: { idMedioDifusion: 1 },
    MEDIOS_UTILIZADOS: { idMedioUtilizado: 1, cantidad: 2 },
    RECURSOS_UTILIZADOS: { idTipoRecurso: 1, cantidad: '45.5' },
    BIENES_DONADOS: { idTipoBienDonado: 1, descripcion: 'Raciones', cantidad: '200' },
    RESUMEN: { texto: 'Resumen de la jornada.' },
  };

  for (const [pestana, esquema] of Object.entries(ESQUEMA_POR_PESTANA)) {
    it(`el esquema de la pestaña ${pestana} es idempotente`, () => {
      const minimo = MINIMOS[pestana];
      expect(minimo, `falta el mínimo de ${pestana} en esta prueba`).toBeDefined();
      esIdempotente(esquema, minimo);
    });
  }
});

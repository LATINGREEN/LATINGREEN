import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Server } from 'node:http';
import { CABECERA_TESTIGO, UMBRAL_SEMEJANZA_ENTIDAD } from '@paid/schema';
import type { EntidadSemejante } from '@paid/schema';
import type { EntornoApi } from './entorno';
import { CLAVE_DESARROLLO, prepararApi, resolverReto } from './entorno';

/**
 * 🚪 PUERTA 4, la parte que una prueba de navegador no puede comprobar.
 *
 * La Fase 4 pide «Entidades A.I. **con sugerencia de duplicados por semejanza
 * antes de guardar**». La prueba de navegador comprueba que la pantalla avisa.
 * Estas comprueban lo otro, que es lo que de verdad protege el maestro: que
 * **el servidor rechaza** la creación sin confirmación explícita.
 *
 * La diferencia importa. Si la deduplicación viviera solo en la pantalla, un
 * `POST` directo se la salta, y `ai.entidad` es un maestro de precedencia: cada
 * actividad apunta a una de esas filas. Dos filas para la misma entidad
 * reparten entre las dos lo que debía sumar junto en los consolidados del RAO,
 * y no falla nada — salen dos cifras donde debía salir una, y cada una parece
 * correcta.
 */

let entorno: EntornoApi;
let servidor: Server;
let testigo = '';
let idTipoEntidad = 0;

async function ingresar(credencial: string): Promise<string> {
  const reto = await request(servidor)
    .post('/api/autenticacion/reto')
    .set('X-Forwarded-For', '10.10.1.5')
    .send({});
  const { idCaptcha, textoReto } = reto.body as { idCaptcha: string; textoReto: string };
  const r = await request(servidor)
    .post('/api/autenticacion/ingreso')
    .set('X-Forwarded-For', '10.10.1.5')
    .send({
      credencial,
      clave: CLAVE_DESARROLLO,
      idCaptcha,
      respuestaCaptcha: resolverReto(textoReto),
    });
  expect(r.status, `ingreso de ${credencial}`).toBe(200);
  return (r.body as { testigo: string }).testigo;
}

function autenticada(metodo: 'get' | 'post' | 'patch' | 'delete', ruta: string) {
  return request(servidor)[metodo](ruta)
    .set(CABECERA_TESTIGO, testigo)
    .set('X-Forwarded-For', '10.10.1.5');
}

beforeAll(async () => {
  entorno = await prepararApi();
  servidor = entorno.app.getHttpServer() as Server;
  testigo = await ingresar('BIM23_PAID');

  const cliente = await entorno.pool.connect();
  try {
    const tipo = await cliente.query<{ id: number }>(
      `SELECT id FROM ref.tipo_entidad ORDER BY orden, id LIMIT 1`,
    );
    idTipoEntidad = Number(tipo.rows[0]?.id);
    expect(idTipoEntidad, 'ref.tipo_entidad está sembrado').toBeGreaterThan(0);
  } finally {
    cliente.release();
  }
}, 120_000);

afterAll(async () => {
  await entorno?.cerrar();
});

describe('Catálogos de ref', () => {
  it('se leen del servidor, no de una copia del cliente', async () => {
    const r = await autenticada('get', '/api/catalogos/tipo_entidad');
    expect(r.status).toBe(200);
    const opciones = r.body as { id: number; codigo: string; nombre: string }[];
    expect(opciones.length).toBeGreaterThan(0);
    expect(opciones[0]).toHaveProperty('nombre');
  });

  /**
   * ⚠️ El nombre del catálogo llega por la URL y se usa como nombre de tabla.
   * Un parámetro enlazado NO protege ahí: un parámetro solo puede ser un
   * valor, nunca un identificador. Por eso la lista es blanca y cerrada, y
   * esta prueba existe para que siga siéndolo.
   */
  it('un nombre fuera de la lista blanca se rechaza, no se interpola', async () => {
    for (const intento of [
      'usuario',
      'seg.usuario',
      'tipo_entidad; DROP TABLE ai.entidad',
      'tipo_entidad UNION SELECT 1',
      '../seg/usuario',
    ]) {
      const r = await autenticada('get', `/api/catalogos/${encodeURIComponent(intento)}`);
      expect(r.status, intento).toBe(400);
    }
  });

  it('los municipios se acotan por departamento', async () => {
    const departamentos = await autenticada('get', '/api/catalogos/departamento');
    expect(departamentos.status).toBe(200);
    const primero = (departamentos.body as { id: number }[])[0];
    expect(primero).toBeDefined();
    const r = await autenticada(
      'get',
      `/api/catalogos/municipio?idDepartamento=${String(primero?.id)}`,
    );
    expect(r.status).toBe(200);
  });
});

describe('R8 — maestro de Personal', () => {
  it('se registra y aparece en el listado de la unidad', async () => {
    const creado = await autenticada('post', '/api/personal').send({
      idTipoDocumentoIdentidad: 1,
      numeroDocumento: '1099887766',
      nombres: 'Sandra Milena',
      apellidos: 'Valencia Córdoba',
    });
    expect(creado.status).toBe(201);

    const listado = await autenticada('get', '/api/personal?texto=Valencia');
    expect(listado.status).toBe(200);
    const filas = (listado.body as { filas: { apellidos: string }[] }).filas;
    expect(filas.some((f) => f.apellidos.includes('Valencia'))).toBe(true);
  });

  /**
   * El mismo número con distinto TIPO de documento son dos personas —una
   * cédula 123 y un pasaporte 123—; con el mismo tipo es un error de
   * digitación. La base lo impone con `UNIQUE (tipo, numero)`; aquí se
   * comprueba que el mensaje que llega dice qué hacer, y no «duplicate key
   * value violates unique constraint».
   */
  it('el mismo documento repetido da 409 con un mensaje accionable', async () => {
    const primero = await autenticada('post', '/api/personal').send({
      idTipoDocumentoIdentidad: 1,
      numeroDocumento: '1055443322',
      nombres: 'Luis',
      apellidos: 'Palomino',
    });
    expect(primero.status).toBe(201);

    const repetido = await autenticada('post', '/api/personal').send({
      idTipoDocumentoIdentidad: 1,
      numeroDocumento: '1055443322',
      nombres: 'Luis Alberto',
      apellidos: 'Palomino Díaz',
    });
    expect(repetido.status).toBe(409);
    const cuerpo = repetido.body as { mensaje: string };
    expect(cuerpo.mensaje).toMatch(/Búsquelo en el listado/u);
    expect(cuerpo.mensaje).not.toMatch(/unique constraint|23505/u);
  });

  it('el número con puntos se rechaza en lugar de limpiarse en silencio', async () => {
    const r = await autenticada('post', '/api/personal').send({
      idTipoDocumentoIdentidad: 1,
      numeroDocumento: '1.055.443.399',
      nombres: 'Ana',
      apellidos: 'Restrepo',
    });
    // Limpiarlo por su cuenta dejaría «1.234» y «1234» como dos filas que la
    // restricción UNIQUE no junta: dos veces la misma persona.
    expect(r.status).toBe(400);
  });
});

describe('Fase 4 — sugerencia de duplicados por semejanza', () => {
  const NOMBRE = 'Alcaldía Municipal de Santiago de Tolú';

  beforeAll(async () => {
    const r = await autenticada('post', '/api/entidades').send({
      idTipoEntidad,
      nombre: NOMBRE,
    });
    expect(r.status).toBe(201);
  });

  it('propone la entidad parecida antes de guardar', async () => {
    const r = await autenticada(
      'get',
      `/api/entidades/semejantes?nombre=${encodeURIComponent('Alcaldia de Santiago de Tolu')}`,
    );
    expect(r.status).toBe(200);
    const cuerpo = r.body as { candidatas: EntidadSemejante[]; umbralBloqueo: number };
    expect(cuerpo.candidatas.length).toBeGreaterThan(0);
    expect(cuerpo.candidatas[0]?.nombre).toBe(NOMBRE);
    expect(cuerpo.candidatas[0]?.semejanza).toBeGreaterThanOrEqual(UMBRAL_SEMEJANZA_ENTIDAD);
  });

  /**
   * Con menos de tres caracteres no hay trigrama, y todo se parece a todo.
   * Devolver candidatas ahí sería ruido, y el ruido enseña a ignorar el aviso.
   */
  it('con menos de tres caracteres no propone nada', async () => {
    const r = await autenticada('get', '/api/entidades/semejantes?nombre=Al');
    expect(r.status).toBe(200);
    expect((r.body as { candidatas: unknown[] }).candidatas).toEqual([]);
  });

  /** ⚠️ El servidor rechaza, no solo la pantalla avisa. */
  it('el mismo nombre con otra tilde se rechaza sin confirmación explícita', async () => {
    const r = await autenticada('post', '/api/entidades').send({
      idTipoEntidad,
      // Normaliza IGUAL que la anterior: sin tildes y en mayúsculas es el
      // mismo texto. No son «parecidos»: es el mismo nombre escrito distinto.
      nombre: 'ALCALDIA MUNICIPAL DE SANTIAGO DE TOLU',
    });
    expect(r.status).toBe(409);
    const cuerpo = r.body as { mensaje: string; detalles: EntidadSemejante[] };
    expect(cuerpo.mensaje).toMatch(/puede ser la misma/u);
    // Las candidatas viajan en la respuesta: un cliente que no las pidió antes
    // las recibe ahora, y no tiene que hacer una segunda consulta para saber
    // contra qué choca.
    expect(cuerpo.detalles.length).toBeGreaterThan(0);
  });

  it('con la confirmación explícita sí se guarda', async () => {
    const r = await autenticada('post', '/api/entidades').send({
      idTipoEntidad,
      nombre: 'ALCALDIA MUNICIPAL DE SANTIAGO DE TOLU',
      confirmoNoEsDuplicado: true,
    });
    expect(r.status).toBe(201);
  });

  /**
   * Un nombre parecido pero por debajo del umbral de bloqueo no estorba: puede
   * haber dos juntas de acción comunal con nombres casi iguales en municipios
   * distintos, y son dos entidades. Avisar es útil; bloquear sería un
   * impedimento para registrar algo legítimo.
   */
  it('un parecido por debajo del umbral de bloqueo no impide guardar', async () => {
    const r = await autenticada('post', '/api/entidades').send({
      idTipoEntidad,
      nombre: 'Hospital Local de Santiago',
    });
    expect(r.status).toBe(201);
  });

  /**
   * R6 — la sugerencia NO puede ser una fuga. Si propusiera entidades de otras
   * unidades, sería una forma de leer el maestro ajeno preguntando por nombres.
   * Lo impide RLS, porque la consulta va dentro de la transacción con contexto,
   * y esta prueba lo comprueba desde fuera.
   */
  it('no propone entidades de otra unidad', async () => {
    const testigoBim23 = testigo;
    testigo = await ingresar('BIM24_PAID');
    try {
      const r = await autenticada(
        'get',
        `/api/entidades/semejantes?nombre=${encodeURIComponent(NOMBRE)}`,
      );
      expect(r.status).toBe(200);
      expect((r.body as { candidatas: unknown[] }).candidatas).toEqual([]);
    } finally {
      testigo = testigoBim23;
    }
  });
});

describe('R13 — la herramienta AID captura georreferenciación', () => {
  /*
   * Lámina 46 (migración 0016): estado, fecha de potenciación y responsable.
   * Los identificadores se leen de la base: el `id` cambia entre despliegues,
   * el `codigo` no.
   */
  const ids: Record<string, number> = {};
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
  const herramienta = (codigo: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    ...GMS,
    idTipoHerramientaAid: ids['tipoEmisora'],
    codigo,
    nombre: 'Emisora de prueba',
    idEstadoHerramienta: ids['estadoActiva'],
    fechaPotenciacion: '10/02/2026',
    idPersonalResponsable: ids['responsable'],
    ...extra,
  });

  beforeAll(async () => {
    const cliente = await entorno.pool.connect();
    try {
      const uno = async (sql: string, valores: unknown[] = []): Promise<number> =>
        Number((await cliente.query<{ id: string }>(sql, valores)).rows[0]?.id);
      ids['tipoEmisora'] = await uno(
        `SELECT id FROM ref.tipo_herramienta_aid WHERE codigo = 'EMISORA_INSTITUCIONAL'`,
      );
      ids['estadoActiva'] = await uno(`SELECT id FROM ref.estado_herramienta_aid WHERE codigo = 'ACTIVA'`);
      ids['estadoInactiva'] = await uno(
        `SELECT id FROM ref.estado_herramienta_aid WHERE codigo = 'INACTIVA'`,
      );
      const persona = async (unidad: string, documento: string, nombres: string): Promise<number> =>
        uno(
          `INSERT INTO ai.personal (id_tipo_documento_identidad, numero_documento, nombres,
             apellidos, correo, telefono, id_unidad, id_estado_registro)
           VALUES ((SELECT id FROM ref.tipo_documento_identidad WHERE codigo = 'CC'), $1, $2,
             'Responsable', 'responsable@armada.mil.co', '3001234567',
             (SELECT id FROM org.unidad WHERE sigla = $3),
             (SELECT id FROM ref.estado_registro WHERE codigo = 'ACTIVO'))
           ON CONFLICT (id_tipo_documento_identidad, numero_documento)
             DO UPDATE SET nombres = EXCLUDED.nombres
           RETURNING id`,
          [documento, nombres, unidad],
        );
      ids['responsable'] = await persona('BIM23', '1011223344', 'Carlos');
      ids['responsableAjeno'] = await persona('BIM24', '1022334455', 'Ajeno');
    } finally {
      cliente.release();
    }
  });

  it('se registra con GMS y las decimales se derivan solas', async () => {
    const creada = await autenticada('post', '/api/herramientas').send(
      herramienta('HAID-PUERTA4-001'),
    );
    expect(creada.status).toBe(201);

    const listado = await autenticada('get', '/api/herramientas?texto=HAID-PUERTA4');
    const filas = (
      listado.body as { filas: { latitudDecimal: number; longitudDecimal: number }[] }
    ).filas;
    expect(filas.length).toBe(1);
    // Las decimales son columnas GENERADAS: no se enviaron, y salen exactas.
    expect(filas[0]?.latitudDecimal).toBeCloseTo(1.791667, 5);
    expect(filas[0]?.longitudDecimal).toBeCloseTo(-78.8125, 5);
  });

  it('unas GMS imposibles se rechazan', async () => {
    const r = await autenticada('post', '/api/herramientas').send(
      herramienta('HAID-PUERTA4-002', { latitudMinutos: 60 }),
    );
    expect(r.status).toBe(400);
  });

  it('el listado trae las columnas del manual: estado, fecha y datos del responsable', async () => {
    await autenticada('post', '/api/herramientas').send(herramienta('HAID-LISTA-001'));
    const r = await autenticada('get', '/api/herramientas?texto=HAID-LISTA');
    const fila = (
      r.body as {
        filas: {
          tipo: string;
          estado: string;
          fechaPotenciacion: string;
          responsable: { nombre: string; documento: string; correo: string; telefono: string };
        }[];
      }
    ).filas[0];
    expect(fila?.tipo).toBe('Emisoras institucionales');
    expect(fila?.estado).toBe('Activa');
    expect(fila?.fechaPotenciacion).toBe('2026-02-10');
    expect(fila?.responsable.documento).toBe('CC 1011223344');
    expect(fila?.responsable.correo).toBe('responsable@armada.mil.co');
    expect(fila?.responsable.telefono).toBe('3001234567');
  });

  it('sin estado, fecha de potenciación ni responsable se rechaza campo por campo', async () => {
    const {
      idEstadoHerramienta: _e,
      fechaPotenciacion: _f,
      idPersonalResponsable: _p,
      ...incompleta
    } = herramienta('HAID-INCOMPLETA');
    const r = await autenticada('post', '/api/herramientas').send(incompleta);
    expect(r.status).toBe(400);
    const campos = (r.body as { detalles: { campo: string }[] }).detalles.map((d) => d.campo);
    expect(campos).toEqual(
      expect.arrayContaining(['idEstadoHerramienta', 'fechaPotenciacion', 'idPersonalResponsable']),
    );
  });

  it('INACTIVA sin observaciones se rechaza señalando las observaciones', async () => {
    const r = await autenticada('post', '/api/herramientas').send(
      herramienta('HAID-INACTIVA-1', { idEstadoHerramienta: ids['estadoInactiva'] }),
    );
    expect(r.status).toBe(400);
    const detalles = (r.body as { detalles: { campo: string }[] }).detalles;
    expect(detalles.map((d) => d.campo)).toEqual(['descripcion']);
  });

  it('INACTIVA con el motivo escrito se registra', async () => {
    const r = await autenticada('post', '/api/herramientas').send(
      herramienta('HAID-INACTIVA-2', {
        idEstadoHerramienta: ids['estadoInactiva'],
        descripcion: 'Transmisor averiado. Se solicitó repuesto al almacén; pendiente por baja si no llega.',
      }),
    );
    expect(r.status).toBe(201);
  });

  it('R8 — un responsable que no está en Personal es MAESTRO_REQUERIDO, no un 500', async () => {
    const r = await autenticada('post', '/api/herramientas').send(
      herramienta('HAID-RESP-1', { idPersonalResponsable: 999999 }),
    );
    expect(r.status).toBe(400);
    const cuerpo = r.body as { codigo: string; detalles: { campo: string }[] };
    expect(cuerpo.codigo).toBe('MAE_REQUERIDO');
    expect(cuerpo.detalles.map((d) => d.campo)).toEqual(['idPersonalResponsable']);
  });

  it('R6 — tampoco vale alguien de OTRA unidad, aunque exista', async () => {
    // La clave foránea se comprueba sin RLS: sin la consulta del servicio,
    // esto se habría guardado.
    const r = await autenticada('post', '/api/herramientas').send(
      herramienta('HAID-RESP-2', { idPersonalResponsable: ids['responsableAjeno'] }),
    );
    expect(r.status).toBe(400);
  });

  it('un tipo inexistente se rechaza señalando el campo, no con un 500', async () => {
    const r = await autenticada('post', '/api/herramientas').send(
      herramienta('HAID-TIPO-1', { idTipoHerramientaAid: 9999 }),
    );
    expect(r.status).toBe(400);
    const detalles = (r.body as { detalles: { campo: string }[] }).detalles;
    expect(detalles.map((d) => d.campo)).toEqual(['idTipoHerramientaAid']);
  });
});

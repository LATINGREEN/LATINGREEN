import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Server } from 'node:http';
import { createHash } from 'node:crypto';
import { CABECERA_TESTIGO, PESTANAS_ACTIVIDAD } from '@paid/schema';
import type { EntornoApi } from './entorno';
import { CLAVE_DESARROLLO, prepararApi, resolverReto } from './entorno';
import { RE_CODIGO_OBSERVADO } from '../comun/generador-codigo';

/**
 * 🚪 PUERTA 3.
 *
 * «pruebas de API que crean una jornada completa con las once pestañas y tres
 *  adjuntos, la modifican, verifican la bitácora y comprueban que
 *  `registro_completo` pasa a verdadero solo cuando todas las pestañas
 *  exigidas tienen datos.»
 *
 * Todo contra la API real, con Postgres y Redis reales.
 */

let entorno: EntornoApi;
let servidor: Server;
let testigo = '';
const MB = 1024 * 1024;

/** Identificadores de los catálogos que las pestañas necesitan. */
const catalogos: Record<string, number> = {};

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

/** GMS de Cartagena. */
const JORNADA_BASE = {
  descripcion:
    'CLAVEGRAMA. Jornada de apoyo al desarrollo en corregimiento de La Boquilla. ' +
    'Se entregaron 120 raciones alimentarias y se atendieron 85 personas en consulta médica. ' +
    'Participó la Fundación El Futuro. Difusión por emisora local.',
  fechaInicio: '05/03/2026',
  fechaEjecucion: '05/03/2026',
  lugar: 'Corregimiento de La Boquilla, Cartagena',
  latitudGrados: 10,
  latitudMinutos: 23,
  latitudSegundos: 27,
  latitudHemisferio: 'N',
  longitudGrados: 75,
  longitudMinutos: 30,
  longitudSegundos: 51,
  longitudHemisferio: 'W',
  coami: [] as string[],
};

/** Un PDF mínimo pero REAL: `file-type` lo reconoce por su firma. */
function pdfDeBytes(bytes: number): Buffer {
  const cabecera = Buffer.from('%PDF-1.4\n', 'latin1');
  const relleno = Buffer.alloc(Math.max(0, bytes - cabecera.length), 0x20);
  return Buffer.concat([cabecera, relleno]);
}

/**
 * Analizador binario para supertest. Sin el, supertest interpreta la respuesta
 * segun su `Content-Type` y devuelve un objeto en lugar de los bytes, asi que
 * no se puede comprobar ni el BOM del CSV ni la firma ZIP del XLSX.
 */
function analizadorBinario(
  respuesta: NodeJS.ReadableStream & { setEncoding?: (c: string) => void },
  devolver: (error: Error | null, cuerpo: Buffer) => void,
): void {
  const trozos: Buffer[] = [];
  respuesta.on('data', (trozo: Buffer) => trozos.push(Buffer.from(trozo)));
  respuesta.on('end', () => devolver(null, Buffer.concat(trozos)));
}

/** Un PNG real. */
function pngMinimo(): Buffer {
  return Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154' +
      '789c63000100000500010d0a2db40000000049454e44ae426082',
    'hex',
  );
}

beforeAll(async () => {
  entorno = await prepararApi();
  servidor = entorno.app.getHttpServer() as Server;

  // La red de las semillas de desarrollo es 0.0.0.0/0, así que 10.10.1.5 pasa.
  // Catálogos que las pestañas necesitan: se siembran vacíos a propósito
  // (Q2/Q4), así que la prueba crea los suyos. No son semillas.
  const cliente = await entorno.pool.connect();
  try {
    const crear = async (tabla: string, codigo: string): Promise<number> => {
      const r = await cliente.query<{ id: number }>(
        `INSERT INTO ref.${tabla} (codigo, nombre) VALUES ($1, $1)
         ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre
         RETURNING id`,
        [codigo],
      );
      return Number(r.rows[0]?.id);
    };
    catalogos['tipoOperacion'] = await crear('tipo_operacion', 'APOYO_DESARROLLO');
    catalogos['servicioPrestado'] = await crear('servicio_prestado', 'CONSULTA_MEDICA');
    catalogos['grupoPoblacional'] = await crear('grupo_poblacional', 'COMUNIDAD');
    catalogos['medioDifusion'] = await crear('medio_difusion', 'EMISORA_LOCAL');
    catalogos['medioUtilizado'] = await crear('medio_utilizado', 'LANCHA');
    catalogos['tipoRecurso'] = await crear('tipo_recurso', 'COMBUSTIBLE');
    catalogos['tipoBienDonado'] = await crear('tipo_bien_donado', 'RACIONES');

    const unidad = await cliente.query<{ id: string }>(
      `SELECT id FROM org.unidad WHERE sigla = 'BIM23'`,
    );
    const entidad = await cliente.query<{ id: string }>(
      `INSERT INTO ai.entidad (id_tipo_entidad, nombre, id_unidad, id_estado_registro)
       VALUES ((SELECT id FROM ref.tipo_entidad WHERE codigo='ONG'),
               'Fundación El Futuro', $1,
               (SELECT id FROM ref.estado_registro WHERE codigo='ACTIVO'))
       RETURNING id`,
      [unidad.rows[0]?.id],
    );
    catalogos['entidad'] = Number(entidad.rows[0]?.id);
  } finally {
    cliente.release();
  }

  testigo = await ingresar('BIM23_PAID');
});

afterAll(async () => {
  if (entorno !== undefined) await entorno.cerrar();
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Q1 — generación del codigo_actividad', () => {
  it('sigue el patrón observado', async () => {
    const r = await autenticada('post', '/api/jornadas').send(JORNADA_BASE);
    expect(r.status).toBe(201);
    const { codigoActividad } = r.body as { codigoActividad: string };
    expect(codigoActividad).toMatch(RE_CODIGO_OBSERVADO);
    // `<unidad>R<mes><año><sufijo de 5>` — BIM23 es 2813304, marzo de 2026.
    expect(codigoActividad.startsWith('2813304R32026')).toBe(true);
    expect(codigoActividad).toHaveLength('2813304R32026'.length + 5);
  });

  it('dos jornadas del mismo mes no colisionan', async () => {
    const codigos = new Set<string>();
    for (let i = 0; i < 6; i += 1) {
      const r = await autenticada('post', '/api/jornadas').send(JORNADA_BASE);
      expect(r.status).toBe(201);
      codigos.add((r.body as { codigoActividad: string }).codigoActividad);
    }
    expect(codigos.size, 'los seis códigos deben ser distintos').toBe(6);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('La jornada completa: once pestañas y tres adjuntos', () => {
  let idJornada = 0;

  it('se crea la jornada', async () => {
    const r = await autenticada('post', '/api/jornadas').send(JORNADA_BASE);
    expect(r.status).toBe(201);
    idJornada = (r.body as { id: number }).id;
    expect(idJornada).toBeGreaterThan(0);
  });

  it('recién creada, registro_completo es FALSE y faltan las once', async () => {
    const r = await autenticada('get', `/api/jornadas/${idJornada}/pestanas`);
    expect(r.status).toBe(200);
    const cuerpo = r.body as { registroCompleto: boolean; faltantes: string[] };
    expect(cuerpo.registroCompleto).toBe(false);
    expect(cuerpo.faltantes).toHaveLength(11);
  });

  it('R11 — la cuota se puede consultar ANTES de subir nada', async () => {
    const r = await autenticada('get', `/api/jornadas/${idJornada}/adjuntos/cuota`);
    expect(r.status).toBe(200);
    const cuota = r.body as {
      bytesUsados: number;
      bytesDisponibles: number;
      cuotaTotalBytes: number;
    };
    expect(cuota.bytesUsados).toBe(0);
    expect(cuota.bytesDisponibles).toBe(10485760);
    expect(cuota.cuotaTotalBytes).toBe(10485760);
  });

  it('se llenan las diez pestañas de datos', async () => {
    const filas: [string, Record<string, unknown>][] = [
      ['TIPO_OPERACION', { idTipoOperacion: catalogos['tipoOperacion'] }],
      ['ENTIDADES_SERVICIOS', { idEntidad: catalogos['entidad'] }],
      ['SERVICIOS_PRESTADOS', { idServicioPrestado: catalogos['servicioPrestado'], cantidad: 85 }],
      ['POBLACION_BENEFICIADA', { idGrupoPoblacional: catalogos['grupoPoblacional'], cantidadPersonas: 120 }],
      ['ENTIDADES_APOYADAS', { idEntidad: catalogos['entidad'] }],
      ['MEDIOS_DIFUSION', { idMedioDifusion: catalogos['medioDifusion'], detalle: 'Emisora local' }],
      ['MEDIOS_UTILIZADOS', { idMedioUtilizado: catalogos['medioUtilizado'], cantidad: 2 }],
      ['RECURSOS_UTILIZADOS', { idTipoRecurso: catalogos['tipoRecurso'], cantidad: 40, unidadMedida: 'galones' }],
      ['BIENES_DONADOS', { idTipoBienDonado: catalogos['tipoBienDonado'], descripcion: '120 raciones alimentarias', cantidad: 120 }],
      ['RESUMEN', { texto: 'Resumen JAD de la jornada en La Boquilla.' }],
    ];

    for (const [pestana, datos] of filas) {
      const r = await autenticada('post', `/api/jornadas/${idJornada}/pestanas/${pestana}`).send(datos);
      expect(r.status, `pestaña ${pestana}: ${JSON.stringify(r.body)}`).toBe(201);
    }
  });

  it('con diez de once, registro_completo SIGUE siendo FALSE', async () => {
    const r = await autenticada('get', `/api/jornadas/${idJornada}/pestanas`);
    const cuerpo = r.body as { registroCompleto: boolean; faltantes: string[] };
    expect(cuerpo.registroCompleto).toBe(false);
    // La que falta es la de adjuntos.
    expect(cuerpo.faltantes).toEqual(['ARCHIVOS_ADJUNTOS']);
  });

  it('se cargan TRES adjuntos, de las tres fases documentales', async () => {
    const adjuntos: [string, Buffer, number][] = [
      ['acta.pdf', pdfDeBytes(2048), 1],
      ['fotografia.png', pngMinimo(), 2],
      ['informe.pdf', pdfDeBytes(4096), 3],
    ];
    for (const [nombre, contenido, fase] of adjuntos) {
      const r = await autenticada('post', `/api/jornadas/${idJornada}/adjuntos`)
        .field('faseDocumental', String(fase))
        .attach('archivo', contenido, nombre);
      expect(r.status, `${nombre}: ${JSON.stringify(r.body)}`).toBe(201);
      const cuerpo = r.body as { hashSha256: string; pesoBytes: number; mimeDetectado: string };
      // El resumen lo calcula el servidor sobre el contenido real.
      expect(cuerpo.hashSha256).toBe(createHash('sha256').update(contenido).digest('hex'));
      expect(cuerpo.pesoBytes).toBe(contenido.byteLength);
    }
  });

  it('AHORA registro_completo pasa a VERDADERO: las once tienen datos', async () => {
    const r = await autenticada('get', `/api/jornadas/${idJornada}/pestanas`);
    const cuerpo = r.body as { registroCompleto: boolean; faltantes: string[] };
    expect(cuerpo.faltantes).toEqual([]);
    expect(cuerpo.registroCompleto, 'con las once pestañas llenas').toBe(true);
  });

  it('y la cuota refleja los tres adjuntos', async () => {
    const r = await autenticada('get', `/api/jornadas/${idJornada}/adjuntos/cuota`);
    const cuota = r.body as { bytesUsados: number };
    expect(cuota.bytesUsados).toBeGreaterThan(6000);
    expect(cuota.bytesUsados).toBeLessThan(8000);
  });

  it('al retirar UNA pestaña, registro_completo vuelve a FALSE', async () => {
    await autenticada('delete', `/api/jornadas/${idJornada}/pestanas/RESUMEN/${idJornada}`)
      .expect(204);
    const r = await autenticada('get', `/api/jornadas/${idJornada}/pestanas`);
    const cuerpo = r.body as { registroCompleto: boolean; faltantes: string[] };
    expect(cuerpo.registroCompleto).toBe(false);
    expect(cuerpo.faltantes).toEqual(['RESUMEN']);

    // Se restituye para las pruebas siguientes.
    await autenticada('post', `/api/jornadas/${idJornada}/pestanas/RESUMEN`)
      .send({ texto: 'Resumen JAD restituido.' })
      .expect(201);
  });

  it('el listado señala los registros incompletos y sus pestañas faltantes', async () => {
    const r = await autenticada('get', '/api/jornadas?porPagina=100');
    expect(r.status).toBe(200);
    const cuerpo = r.body as {
      filas: { id: number; registroCompleto: boolean; pestanasFaltantes: string[] }[];
    };
    const completa = cuerpo.filas.find((f) => f.id === idJornada);
    expect(completa?.registroCompleto).toBe(true);
    expect(completa?.pestanasFaltantes).toEqual([]);

    // Las creadas en las pruebas de Q1 están vacías.
    const incompletas = cuerpo.filas.filter((f) => !f.registroCompleto);
    expect(incompletas.length).toBeGreaterThan(0);
    expect(incompletas[0]?.pestanasFaltantes.length).toBe(11);
  });

  it('se MODIFICA la jornada', async () => {
    await autenticada('patch', `/api/jornadas/${idJornada}`)
      .send({ lugar: 'Corregimiento de La Boquilla (corregido)', fechaFin: '06/03/2026' })
      .expect(204);

    const r = await autenticada('get', '/api/jornadas?porPagina=100');
    const fila = (r.body as { filas: { id: number; lugar: string }[] }).filas.find(
      (f) => f.id === idJornada,
    );
    expect(fila?.lugar).toBe('Corregimiento de La Boquilla (corregido)');
  });

  it('R15 — la bitácora registró la creación y la modificación', async () => {
    const r = await entorno.pool.query<{
      operacion: string;
      id_usuario: string | null;
      anterior: { lugar?: string } | null;
      posterior: { lugar?: string } | null;
    }>(
      `SELECT operacion, id_usuario, imagen_anterior AS anterior, imagen_posterior AS posterior
         FROM aud.bitacora_cambio
        WHERE tabla = 'jornada_apoyo' AND id_registro = $1
        ORDER BY id`,
      [idJornada],
    );

    const operaciones = r.rows.map((f) => f.operacion);
    expect(operaciones, 'una inserción y al menos una modificación').toContain('I');
    expect(operaciones).toContain('U');

    const modificacion = r.rows.find((f) => f.operacion === 'U');
    expect(modificacion?.anterior?.lugar).toBe('Corregimiento de La Boquilla, Cartagena');
    expect(modificacion?.posterior?.lugar).toBe('Corregimiento de La Boquilla (corregido)');
    // El usuario sale del contexto de R7, no de un parámetro.
    expect(modificacion?.id_usuario).not.toBeNull();
  });

  it('R15 — también quedó la bitácora de las once pestañas y de los adjuntos', async () => {
    const r = await entorno.pool.query<{ tabla: string }>(
      `SELECT DISTINCT tabla FROM aud.bitacora_cambio
        WHERE esquema = 'ai' AND tabla LIKE 'act\\_%'`,
    );
    const tablas = r.rows.map((f) => f.tabla);
    // Las diez de datos más la de adjuntos.
    expect(tablas.length).toBeGreaterThanOrEqual(11);
    expect(tablas).toContain('act_poblacion_beneficiada');
    expect(tablas).toContain('act_adjunto');
  });

  it('R13 — el punto del mapa corresponde a lo digitado', async () => {
    const r = await entorno.pool.query<{ lat: string; lon: string; punto_lat: string }>(
      `SELECT latitud_decimal::text AS lat, longitud_decimal::text AS lon,
              ST_Y(ubicacion::geometry)::numeric(9,6)::text AS punto_lat
         FROM ai.actividad WHERE id = $1`,
      [idJornada],
    );
    expect(Number(r.rows[0]?.lat)).toBeCloseTo(10.390833, 6);
    expect(Number(r.rows[0]?.lon)).toBeCloseTo(-75.514167, 6);
    expect(Number(r.rows[0]?.punto_lat)).toBe(Number(r.rows[0]?.lat));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('R12 — el contenido real manda sobre la extensión declarada', () => {
  let idJornada = 0;

  beforeAll(async () => {
    const r = await autenticada('post', '/api/jornadas').send(JORNADA_BASE);
    idJornada = (r.body as { id: number }).id;
  });

  it('un ejecutable renombrado a .jpg es RECHAZADO', async () => {
    // Firma real de un ejecutable de Windows: «MZ».
    const ejecutable = Buffer.concat([
      Buffer.from('4d5a', 'hex'),
      Buffer.alloc(200, 0),
    ]);
    const r = await autenticada('post', `/api/jornadas/${idJornada}/adjuntos`)
      .field('faseDocumental', '1')
      .attach('archivo', ejecutable, 'fotografia.jpg');
    expect(r.status).toBe(415);
    expect((r.body as { codigo: string }).codigo).toBe('ADJ_TIPO_NO_PERMITIDO');
  });

  it('un zip renombrado a .pdf es RECHAZADO', async () => {
    const zip = Buffer.concat([Buffer.from('504b0304', 'hex'), Buffer.alloc(200, 0)]);
    const r = await autenticada('post', `/api/jornadas/${idJornada}/adjuntos`)
      .field('faseDocumental', '1')
      .attach('archivo', zip, 'informe.pdf');
    expect(r.status).toBe(415);
  });

  it('una extensión fuera del catálogo es RECHAZADA', async () => {
    const r = await autenticada('post', `/api/jornadas/${idJornada}/adjuntos`)
      .field('faseDocumental', '1')
      .attach('archivo', pdfDeBytes(500), 'soporte.exe');
    expect(r.status).toBe(415);
  });

  it('un archivo vacío es RECHAZADO', async () => {
    const r = await autenticada('post', `/api/jornadas/${idJornada}/adjuntos`)
      .field('faseDocumental', '1')
      .attach('archivo', Buffer.alloc(0), 'vacio.pdf');
    expect(r.status).toBeGreaterThanOrEqual(400);
  });

  it('un .pdf que de verdad es PDF es ACEPTADO', async () => {
    const r = await autenticada('post', `/api/jornadas/${idJornada}/adjuntos`)
      .field('faseDocumental', '1')
      .attach('archivo', pdfDeBytes(1024), 'acta.pdf');
    expect(r.status).toBe(201);
    expect((r.body as { mimeDetectado: string }).mimeDetectado).toBe('application/pdf');
  });

  it('nada quedó en el almacén de los archivos rechazados', async () => {
    // Si un rechazo hubiera escrito el binario antes de validar, habría
    // objetos huérfanos. Se comprueba contando filas: solo el aceptado.
    const r = await entorno.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM ai.act_adjunto WHERE id_actividad = $1`,
      [idJornada],
    );
    expect(Number(r.rows[0]?.n)).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('R11 — la cuota AGREGADA, por la API', () => {
  let idJornada = 0;

  beforeAll(async () => {
    const r = await autenticada('post', '/api/jornadas').send(JORNADA_BASE);
    idJornada = (r.body as { id: number }).id;
  });

  it('un archivo de 9 MB entra', async () => {
    const r = await autenticada('post', `/api/jornadas/${idJornada}/adjuntos`)
      .field('faseDocumental', '1')
      .attach('archivo', pdfDeBytes(9 * MB), 'grande.pdf');
    expect(r.status).toBe(201);
  });

  it('el siguiente de 2 MB NO entra, y el mensaje explica que la cuota es del total', async () => {
    const r = await autenticada('post', `/api/jornadas/${idJornada}/adjuntos`)
      .field('faseDocumental', '2')
      .attach('archivo', pdfDeBytes(2 * MB), 'otro.pdf');
    expect(r.status).toBe(413);
    const cuerpo = r.body as { codigo: string; mensaje: string };
    expect(cuerpo.codigo).toBe('ADJ_CUOTA_AGOTADA');
    expect(cuerpo.mensaje).toContain('del total de la actividad');
  });

  it('el rechazo NO dejó fila ni consumió cuota', async () => {
    const r = await autenticada('get', `/api/jornadas/${idJornada}/adjuntos/cuota`);
    const cuota = r.body as { bytesUsados: number };
    expect(cuota.bytesUsados).toBe(9 * MB);
  });

  it('pero en OTRA actividad, los 2 MB entran', async () => {
    const creada = await autenticada('post', '/api/jornadas').send(JORNADA_BASE);
    const otra = (creada.body as { id: number }).id;
    const r = await autenticada('post', `/api/jornadas/${otra}/adjuntos`)
      .field('faseDocumental', '1')
      .attach('archivo', pdfDeBytes(2 * MB), 'otro.pdf');
    expect(r.status).toBe(201);
  });

  it('dar de baja un adjunto libera su espacio (R14 + R11)', async () => {
    const fila = await entorno.pool.query<{ id: string }>(
      `SELECT id FROM ai.act_adjunto WHERE id_actividad = $1 ORDER BY id LIMIT 1`,
      [idJornada],
    );
    await autenticada(
      'delete',
      `/api/jornadas/${idJornada}/adjuntos/${fila.rows[0]?.id}`,
    ).expect(204);

    const r = await autenticada('get', `/api/jornadas/${idJornada}/adjuntos/cuota`);
    expect((r.body as { bytesUsados: number }).bytesUsados).toBe(0);

    // Y ahora el de 2 MB sí cabe.
    const reintento = await autenticada('post', `/api/jornadas/${idJornada}/adjuntos`)
      .field('faseDocumental', '2')
      .attach('archivo', pdfDeBytes(2 * MB), 'otro.pdf');
    expect(reintento.status).toBe(201);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Exportación XLSX y CSV, con registro en aud.exportacion', () => {
  it('el CSV escapa comas, comillas y saltos de línea (RFC 4180)', async () => {
    /*
     * Se crea una jornada con los tres casos que rompen un CSV mal escrito:
     * una coma, una comilla doble y un salto de línea. Un clavegrama real
     * lleva los tres, así que esto no es un caso de laboratorio.
     */
    await autenticada('post', '/api/jornadas').send({
      ...JORNADA_BASE,
      descripcion: 'CLAVEGRAMA, con coma.\nSegunda línea con "comillas" dentro.',
      lugar: 'Lugar, con coma',
    });

    const r = await autenticada('get', '/api/jornadas/exportacion/csv')
      .buffer(true)
      .parse(analizadorBinario);
    const texto = (r.body as Buffer).toString('utf8');

    // Coma -> el campo va entre comillas.
    expect(texto).toContain('"CLAVEGRAMA, con coma.');
    // Comilla interna -> se duplica.
    expect(texto).toContain('""comillas""');
    // Salto de línea dentro del campo -> va dentro de las comillas, no rompe
    // la fila. Si el escapado fallara, el archivo tendría una fila de más.
    expect(texto).toContain('"Lugar, con coma"');
  });

  it('el CSV sale con BOM y con los encabezados en español', async () => {
    // `.buffer(true)` con un analizador binario: sin el, supertest interpreta
    // la respuesta segun su Content-Type y devuelve un objeto, no los bytes.
    const r = await autenticada('get', '/api/jornadas/exportacion/csv')
      .buffer(true)
      .parse(analizadorBinario);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.headers['content-disposition']).toContain('attachment');

    const texto = (r.body as Buffer).toString('utf8');
    // BOM: sin él, Excel en Windows destroza las tildes.
    expect(texto.charCodeAt(0)).toBe(0xfeff);
    // Y que las tildes y las eñes de los encabezados lleguen intactas, que es
    // para lo que sirve el BOM.
    expect(texto).toContain('Fecha ejecución');
    expect(texto).toContain('Descripción');
    expect(texto).toContain('Pestañas faltantes');
  });

  it('el XLSX es un archivo de Excel de verdad', async () => {
    const r = await autenticada('get', '/api/jornadas/exportacion/xlsx')
      .buffer(true)
      .parse(analizadorBinario);
    expect(r.status).toBe(200);
    const contenido = r.body as Buffer;
    // Un .xlsx es un ZIP: firma PK\x03\x04.
    expect(contenido.subarray(0, 4).toString('hex')).toBe('504b0304');
    expect(contenido.byteLength).toBeGreaterThan(3000);
  });

  it('cada exportación queda en aud.exportacion con sus filtros', async () => {
    await autenticada('get', '/api/jornadas/exportacion/csv?soloCompletas=true');

    const r = await entorno.pool.query<{
      formato: string;
      modulo: string;
      filtros: Record<string, unknown>;
      cantidad_filas: number;
      id_usuario: string;
    }>(
      `SELECT formato, modulo, filtros, cantidad_filas, id_usuario
         FROM aud.exportacion ORDER BY id DESC LIMIT 1`,
    );
    const fila = r.rows[0];
    expect(fila?.modulo).toBe('JORNADAS');
    expect(fila?.formato).toBe('CSV');
    // Sin los filtros, «exportó jornadas» no dice cuántas ni de quién.
    expect(fila?.filtros['soloCompletas']).toBe(true);
    expect(fila?.id_usuario).not.toBeNull();
  });

  it('`soloCompletas` filtra de verdad: es lo que usan los consolidados del RAO', async () => {
    const todas = await autenticada('get', '/api/jornadas?porPagina=500');
    const completas = await autenticada('get', '/api/jornadas?porPagina=500&soloCompletas=true');
    const nTodas = (todas.body as { filas: unknown[] }).filas.length;
    const nCompletas = (completas.body as { filas: { registroCompleto: boolean }[] }).filas;
    expect(nCompletas.length).toBeLessThan(nTodas);
    expect(nCompletas.every((f) => f.registroCompleto)).toBe(true);
  });

  it('un formato desconocido es rechazado', async () => {
    const r = await autenticada('get', '/api/jornadas/exportacion/pdf');
    expect(r.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Las reglas siguen en pie a través de la API', () => {
  it('R6 — BIM24 no ve las jornadas de BIM23', async () => {
    const testigoBim24 = await ingresar('BIM24_PAID');
    const r = await request(servidor)
      .get('/api/jornadas?porPagina=500')
      .set(CABECERA_TESTIGO, testigoBim24)
      .set('X-Forwarded-For', '10.10.1.5');
    expect(r.status).toBe(200);
    expect((r.body as { filas: unknown[] }).filas).toHaveLength(0);
  });

  it('R9 — no hay forma de enviar participo_arc en falso', async () => {
    const r = await autenticada('post', '/api/jornadas').send({
      ...JORNADA_BASE,
      participoArc: false,
    });
    expect(r.status).toBe(400);
  });

  /*
   * ⚠️ Esta prueba CAMBIÓ de intención, deliberadamente. Antes exigía que
   * `2026-03-05` fuera rechazada.
   *
   * A.2.4 existe para que una fecha DIGITADA no se lea al revés: `03/05/2026`
   * es el 3 de mayo o el 5 de marzo según el país. Eso sigue impuesto, y es lo
   * que esta prueba comprueba ahora: el formato estadounidense se rechaza.
   *
   * Pero la forma ISO es la SALIDA del propio esquema, y el esquema es el
   * mismo en el formulario y aquí (A.6), así que corre dos veces sobre el
   * mismo dato. Rechazarla significaba que el formulario validaba, enviaba
   * `2026-03-05` y este controlador respondía «No se pudo registrar la
   * jornada»: el formulario de jornadas no podía guardar por la interfaz, y
   * ninguna de las 80 pruebas de estas puertas lo veía, porque todas envían
   * `dd/mm/aaaa` directamente. Lo encontró la Puerta 4.
   *
   * Ver docs/DECISIONES.md, D-25, y packages/schema/src/idempotencia.test.ts.
   */
  it('A.2.4 — el formato estadounidense se rechaza; la salida ISO del propio esquema se admite', async () => {
    const ambiguo = await autenticada('post', '/api/jornadas').send({
      ...JORNADA_BASE,
      fechaEjecucion: '3/5/2026',
    });
    expect(ambiguo.status).toBe(400);
    const detalles = (ambiguo.body as { detalles: { campo: string; mensaje: string }[] })
      .detalles;
    expect(detalles.some((d) => d.campo === 'fechaEjecucion')).toBe(true);

    const yaNormalizada = await autenticada('post', '/api/jornadas').send({
      ...JORNADA_BASE,
      fechaEjecucion: '2026-03-05',
    });
    expect(yaNormalizada.status).toBe(201);
  });

  it('R13 — unas GMS imposibles son rechazadas', async () => {
    const r = await autenticada('post', '/api/jornadas').send({
      ...JORNADA_BASE,
      latitudMinutos: 60,
    });
    expect(r.status).toBe(400);
  });

  it('R19 — una pestaña que no existe es rechazada con un mensaje útil', async () => {
    const creada = await autenticada('post', '/api/jornadas').send(JORNADA_BASE);
    const id = (creada.body as { id: number }).id;
    const r = await autenticada('post', `/api/jornadas/${id}/pestanas/PESTANA_INVENTADA`).send({});
    expect(r.status).toBe(400);
    expect((r.body as { mensaje: string }).mensaje).toContain('no es una pestaña de datos');
  });

  it('los archivos adjuntos NO se pueden llenar por la ruta de pestañas', async () => {
    const creada = await autenticada('post', '/api/jornadas').send(JORNADA_BASE);
    const id = (creada.body as { id: number }).id;
    const r = await autenticada('post', `/api/jornadas/${id}/pestanas/ARCHIVOS_ADJUNTOS`).send({});
    expect(r.status).toBe(400);
    expect((r.body as { mensaje: string }).mensaje).toContain('su propia ruta');
  });

  it('una cantidad en cero es rechazada: no distingue «no hubo» de «no se contó»', async () => {
    const creada = await autenticada('post', '/api/jornadas').send(JORNADA_BASE);
    const id = (creada.body as { id: number }).id;
    const r = await autenticada('post', `/api/jornadas/${id}/pestanas/POBLACION_BENEFICIADA`).send({
      idGrupoPoblacional: catalogos['grupoPoblacional'],
      cantidadPersonas: 0,
    });
    expect(r.status).toBe(400);
  });

  it('las once pestañas de R19 siguen siendo once', () => {
    expect(PESTANAS_ACTIVIDAD).toHaveLength(11);
  });

  it('un error de la API lleva su idCorrelacion', async () => {
    const r = await autenticada('get', '/api/jornadas/999999999/pestanas');
    expect(r.status).toBe(404);
    const cuerpo = r.body as { codigo: string; idCorrelacion: string };
    expect(cuerpo.codigo).toBe('REG_NO_ENCONTRADO');
    expect(cuerpo.idCorrelacion).toMatch(/^[0-9a-f-]{36}$/);
  });
});

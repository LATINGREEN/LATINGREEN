import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Server } from 'node:http';
import { connect } from 'node:net';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CABECERA_TESTIGO } from '@paid/schema';
import type { EntornoApi } from './entorno';
import { CLAVE_DESARROLLO, prepararApi, resolverReto } from './entorno';

/**
 * 🚪 PUERTA 5 — «la Parte A funciona completa **sin ningún componente de IA
 * desplegado**».
 *
 * Toda la batería corre ya sin IA: ninguna prueba levanta el servicio `ia`.
 * Pero eso solo demuestra que HOY nadie lo llama, y la Puerta 5 existe para
 * que siga siendo así cuando llegue la Parte B. Aquí se fija con dos cosas:
 *
 * 1. **La peor configuración posible.** La API arranca con la IA *habilitada*
 *    y apuntando a un puerto donde no escucha nadie —lo que pasaría con el
 *    indicador mal puesto o el contenedor caído— y el camino de la Parte A
 *    se recorre entero: ingreso, los tres maestros, jornada con pestaña y
 *    adjunto, listado, exportación, bitácora y salida.
 * 2. **La estructura.** Ningún código de la Parte A nombra el servicio de IA,
 *    y en `docker-compose.yml` ningún servicio por omisión depende de él.
 *    Cuando la Parte B lo use, tendrá que hacerlo desde un sitio que estas
 *    pruebas conozcan, no desde cualquier controlador.
 */

/** Puerto 9 (discard): en la máquina de pruebas no escucha nadie. */
const URL_IA_INALCANZABLE = 'http://127.0.0.1:9';

const RAIZ = join(__dirname, '..', '..', '..', '..');

let entorno: EntornoApi;
let servidor: Server;
let testigo = '';
const entornoPrevio: Record<string, string | undefined> = {};

function autenticada(metodo: 'get' | 'post' | 'patch' | 'delete', ruta: string) {
  return request(servidor)[metodo](ruta)
    .set(CABECERA_TESTIGO, testigo)
    .set('X-Forwarded-For', '10.10.1.5');
}

/** ¿Hay algo escuchando? Se comprueba en vez de suponerlo. */
function escucha(url: string): Promise<boolean> {
  const { hostname, port } = new URL(url);
  return new Promise((resolver) => {
    const socket = connect({ host: hostname, port: Number(port) });
    socket.once('connect', () => {
      socket.destroy();
      resolver(true);
    });
    socket.once('error', () => resolver(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolver(false);
    });
  });
}

beforeAll(async () => {
  for (const clave of ['IA_HABILITADA', 'IA_URL', 'IA_TIMEOUT_MS']) {
    entornoPrevio[clave] = process.env[clave];
  }
  process.env['IA_HABILITADA'] = 'true';
  process.env['IA_URL'] = URL_IA_INALCANZABLE;
  process.env['IA_TIMEOUT_MS'] = '200';

  entorno = await prepararApi();
  servidor = entorno.app.getHttpServer() as Server;
});

afterAll(async () => {
  if (entorno !== undefined) await entorno.cerrar();
  for (const [clave, valor] of Object.entries(entornoPrevio)) {
    if (valor === undefined) delete process.env[clave];
    else process.env[clave] = valor;
  }
});

describe('Puerta 5 — la Parte A con la IA habilitada y caída', () => {
  it('de verdad no hay nada escuchando donde la API cree que está la IA', async () => {
    expect(await escucha(URL_IA_INALCANZABLE)).toBe(false);
  });

  it('ingresa', async () => {
    const reto = await request(servidor)
      .post('/api/autenticacion/reto')
      .set('X-Forwarded-For', '10.10.1.5')
      .send({});
    const { idCaptcha, textoReto } = reto.body as { idCaptcha: string; textoReto: string };
    const r = await request(servidor)
      .post('/api/autenticacion/ingreso')
      .set('X-Forwarded-For', '10.10.1.5')
      .send({
        credencial: 'BIM23_PAID',
        clave: CLAVE_DESARROLLO,
        idCaptcha,
        respuestaCaptcha: resolverReto(textoReto),
      });
    expect(r.status).toBe(200);
    testigo = (r.body as { testigo: string }).testigo;
  });

  const ids: Record<string, number> = {};

  it('registra los tres maestros de precedencia (R8)', async () => {
    const cliente = await entorno.pool.connect();
    try {
      const uno = async (sql: string): Promise<number> =>
        Number((await cliente.query<{ id: string }>(sql)).rows[0]?.id);
      ids['cc'] = await uno(`SELECT id FROM ref.tipo_documento_identidad WHERE codigo = 'CC'`);
      ids['ong'] = await uno(`SELECT id FROM ref.tipo_entidad WHERE codigo = 'ONG'`);
      ids['emisora'] = await uno(
        `SELECT id FROM ref.tipo_herramienta_aid WHERE codigo = 'EMISORA_INSTITUCIONAL'`,
      );
      ids['activa'] = await uno(`SELECT id FROM ref.estado_herramienta_aid WHERE codigo = 'ACTIVA'`);
      ids['conjunta'] = await uno(`SELECT id FROM ref.tipo_jornada WHERE codigo = 'CONJUNTA'`);
    } finally {
      cliente.release();
    }

    const persona = await autenticada('post', '/api/personal').send({
      idTipoDocumentoIdentidad: ids['cc'],
      numeroDocumento: '1077665544',
      nombres: 'Sin',
      apellidos: 'Inteligencia Artificial',
    });
    expect(persona.status, JSON.stringify(persona.body)).toBe(201);
    ids['persona'] = (persona.body as { id: number }).id;

    const entidad = await autenticada('post', '/api/entidades').send({
      idTipoEntidad: ids['ong'],
      nombre: 'Fundación Puerta Cinco',
    });
    expect(entidad.status, JSON.stringify(entidad.body)).toBe(201);

    const herramienta = await autenticada('post', '/api/herramientas').send({
      idTipoHerramientaAid: ids['emisora'],
      codigo: 'HAID-P5-001',
      nombre: 'Emisora Puerta Cinco',
      idEstadoHerramienta: ids['activa'],
      fechaPotenciacion: '01/03/2025',
      idPersonalResponsable: ids['persona'],
      latitudGrados: 1,
      latitudMinutos: 47,
      latitudSegundos: 30,
      latitudHemisferio: 'N',
      longitudGrados: 78,
      longitudMinutos: 48,
      longitudSegundos: 45,
      longitudHemisferio: 'W',
    });
    expect(herramienta.status, JSON.stringify(herramienta.body)).toBe(201);
  });

  it('registra una jornada, diligencia una pestaña y adjunta un soporte', async () => {
    const creada = await autenticada('post', '/api/jornadas').send({
      descripcion: 'CLAVEGRAMA. Jornada registrada sin ningún componente de IA desplegado.',
      fechaInicio: '05/03/2026',
      fechaEjecucion: '05/03/2026',
      lugar: 'Vereda La Playa',
      idTipoJornada: ids['conjunta'],
      participoEjc: false,
      participoFac: false,
      poblacionAfectaTropa: true,
      latitudGrados: 1,
      latitudMinutos: 47,
      latitudSegundos: 30,
      latitudHemisferio: 'N',
      longitudGrados: 78,
      longitudMinutos: 48,
      longitudSegundos: 45,
      longitudHemisferio: 'W',
      coami: [],
    });
    expect(creada.status, JSON.stringify(creada.body)).toBe(201);
    ids['jornada'] = (creada.body as { id: number }).id;

    const resumen = await autenticada('post', `/api/jornadas/${ids['jornada']}/pestanas/RESUMEN`).send(
      { texto: 'Resumen escrito a mano: la extracción asistida (U1) no existe todavía.' },
    );
    expect(resumen.status, JSON.stringify(resumen.body)).toBe(201);

    const pdf = Buffer.concat([
      Buffer.from('%PDF-1.4\n', 'latin1'),
      Buffer.alloc(2048, 0x20),
    ]);
    const adjunto = await autenticada('post', `/api/jornadas/${ids['jornada']}/adjuntos`)
      .field('faseDocumental', '1')
      .attach('archivo', pdf, 'acta.pdf');
    expect(adjunto.status, JSON.stringify(adjunto.body)).toBe(201);
  });

  it('lista, lee el detalle y exporta', async () => {
    const listado = await autenticada('get', '/api/jornadas');
    expect(listado.status).toBe(200);
    const detalle = await autenticada('get', `/api/jornadas/${ids['jornada']}`);
    expect(detalle.status).toBe(200);
    expect((detalle.body as { tipoJornada: string }).tipoJornada).toBe('Conjunta');
    const csv = await autenticada('get', '/api/jornadas/exportacion/csv');
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
  });

  it('la bitácora registró todo por disparador (R15)', async () => {
    const r = await entorno.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM aud.bitacora_cambio
        WHERE esquema = 'ai' AND tabla = 'jornada_apoyo' AND id_registro = $1`,
      [ids['jornada']],
    );
    expect(Number(r.rows[0]?.n)).toBeGreaterThan(0);
  });

  it('cierra la sesión', async () => {
    const r = await autenticada('post', '/api/autenticacion/salida');
    expect(r.status).toBeLessThan(300);
    const despues = await autenticada('get', '/api/jornadas');
    expect(despues.status).toBe(401);
  });

  it('y en ningún momento hubo nada escuchando en la dirección de la IA', async () => {
    expect(await escucha(URL_IA_INALCANZABLE)).toBe(false);
  });
});

/** Archivos de código de un directorio, recursivo, sin dependencias ni compilados. */
function codigoEn(directorio: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(directorio)) {
    if (nombre === 'node_modules' || nombre === 'dist' || nombre === 'pruebas') continue;
    const ruta = join(directorio, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...codigoEn(ruta));
    else if (/\.(ts|tsx|mjs|js)$/u.test(nombre) && !/\.test\.tsx?$/u.test(nombre)) salida.push(ruta);
  }
  return salida;
}

describe('Puerta 5 — la estructura no depende de la IA', () => {
  it('ningún código de la Parte A llama al servicio de IA', () => {
    const directorios = [
      join(RAIZ, 'apps', 'api', 'src'),
      join(RAIZ, 'apps', 'web', 'src'),
      join(RAIZ, 'packages', 'schema', 'src'),
      join(RAIZ, 'packages', 'db', 'src'),
    ];
    /*
     * La única mención admitida es la DECLARACIÓN de la configuración
     * (`configuracion.ts`: el indicador, apagado por omisión). Cualquier otro
     * archivo que lea `IA_URL` o apunte al puerto del servicio es la Parte A
     * dependiendo de la Parte B.
     */
    const admitidos = new Set([join(RAIZ, 'apps', 'api', 'src', 'configuracion.ts')]);
    const patron = /IA_URL|IA_HABILITADA|:8000\b|\/ia\//u;
    const infractores = directorios
      .flatMap(codigoEn)
      .filter((ruta) => !admitidos.has(ruta))
      .filter((ruta) => patron.test(readFileSync(ruta, 'utf8')))
      .map((ruta) => relative(RAIZ, ruta));
    expect(infractores).toEqual([]);
  });

  it('en docker-compose, `ia` es opcional y ningún servicio por omisión depende de él', () => {
    const lineas = readFileSync(join(RAIZ, 'docker-compose.yml'), 'utf8').split('\n');
    // Bloques de servicio: nombres con dos espacios de sangría bajo `services:`.
    const bloques = new Map<string, string[]>();
    let enServicios = false;
    let actual: string | null = null;
    for (const linea of lineas) {
      if (/^services:\s*$/u.test(linea)) {
        enServicios = true;
        continue;
      }
      if (/^\S/u.test(linea)) enServicios = false;
      if (!enServicios) continue;
      const nombre = /^ {2}([a-z0-9-]+):\s*$/u.exec(linea);
      if (nombre !== null) {
        actual = nombre[1] ?? null;
        if (actual !== null) bloques.set(actual, []);
      } else if (actual !== null) {
        bloques.get(actual)?.push(linea);
      }
    }

    expect(bloques.has('ia')).toBe(true);
    expect((bloques.get('ia') ?? []).join('\n')).toMatch(/profiles:\s*\[\s*'ia'\s*\]/u);

    for (const [servicio, cuerpo] of bloques) {
      if (servicio === 'ia') continue;
      const texto = cuerpo.join('\n');
      expect(texto, `${servicio} no debe depender de ia`).not.toMatch(/^\s{6}ia:\s*$/mu);
      expect(texto, `${servicio} no debe depender de ia`).not.toMatch(/-\s*ia\s*$/mu);
      // Ningún servicio de la Parte A lleva perfil: arrancan con `docker compose up`.
      expect(texto, `${servicio} debe arrancar sin perfil`).not.toMatch(/profiles:/u);
    }
  });

  it('la IA está apagada por omisión en la configuración de la API y del despliegue', async () => {
    const { validarConfiguracion } = await import('../configuracion');
    const minima = validarConfiguracion({
      DATABASE_URL: 'postgres://x:y@127.0.0.1:5432/z',
    });
    expect(minima.IA_HABILITADA).toBe(false);
    const compose = readFileSync(join(RAIZ, 'docker-compose.yml'), 'utf8');
    expect(compose).toContain('IA_HABILITADA: ${IA_HABILITADA:-false}');
  });
});

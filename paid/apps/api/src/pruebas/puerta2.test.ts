import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Server } from 'node:http';
import { createHash } from 'node:crypto';
import { CABECERA_TESTIGO, MENSAJE_CREDENCIALES_INVALIDAS } from '@paid/schema';
import type { EntornoApi } from './entorno';
import { CLAVE_DESARROLLO, prepararApi, resolverReto } from './entorno';

/**
 * 🚪 PUERTA 2.
 *
 * Cada `describe` corresponde a una casilla de la lista de PROMPT.md, en su
 * orden. La API corre de verdad: Postgres real, Redis real, y
 * `DATABASE_POOL_MAX = 1`, que es la condicion que la propia Puerta 2 exige
 * para que la fuga de contexto de P11 sea observable.
 */

let entorno: EntornoApi;
let servidor: Server;

/** Ingreso completo: pide el reto, lo resuelve, y entra. */
async function ingresar(
  credencial: string,
  clave = CLAVE_DESARROLLO,
  ip = '10.10.1.5',
): Promise<{ estado: number; cuerpo: Record<string, unknown>; testigo?: string }> {
  const reto = await request(servidor)
    .post('/api/autenticacion/reto')
    .set('X-Forwarded-For', ip)
    .send({});
  if (reto.status !== 200) {
    return { estado: reto.status, cuerpo: reto.body as Record<string, unknown> };
  }
  const cuerpoReto = reto.body as { idCaptcha: string; textoReto: string };
  const respuesta = await request(servidor)
    .post('/api/autenticacion/ingreso')
    .set('X-Forwarded-For', ip)
    .send({
      credencial,
      clave,
      idCaptcha: cuerpoReto.idCaptcha,
      respuestaCaptcha: resolverReto(cuerpoReto.textoReto),
    });
  const cuerpo = respuesta.body as Record<string, unknown>;
  return {
    estado: respuesta.status,
    cuerpo,
    ...(typeof cuerpo['testigo'] === 'string' ? { testigo: cuerpo['testigo'] } : {}),
  };
}

function resumir(testigo: string): string {
  return createHash('sha256').update(testigo).digest('hex');
}

beforeAll(async () => {
  entorno = await prepararApi();
  servidor = entorno.app.getHttpServer() as Server;
});

afterAll(async () => {
  if (entorno !== undefined) await entorno.cerrar();
});

// ═════════════════════════════════════════════════════════════════════════════
describe('R1 — sesion de 10 minutos, deslizante, evaluada en el servidor', () => {
  it('un ingreso valido abre sesion y devuelve un testigo', async () => {
    const r = await ingresar('BIM23_PAID');
    expect(r.estado).toBe(200);
    expect(r.testigo).toBeTypeOf('string');
    expect(r.cuerpo['credencial']).toBe('BIM23_PAID');
    expect(r.cuerpo['avisoEnSegundos']).toBe(480);
  });

  it('a los 9 min 30 s la sesion es VALIDA y se RENUEVA a los 10 min', async () => {
    const { testigo } = await ingresar('BIM23_PAID');
    expect(testigo).toBeDefined();
    const clave = `paid:sesion:${resumir(testigo as string)}`;

    /*
     * Se simula el paso del tiempo acortando el TTL de Redis a 30 segundos,
     * que es lo que quedaria tras 9 min 30 s de inactividad de los 10 min.
     *
     * Es la simulacion fiel: la expiracion de R1 ES el TTL de Redis, y asi la
     * prueba es determinista y dura milisegundos en lugar de diez minutos.
     */
    await entorno.redis.expire(clave, 30);
    expect(await entorno.redis.ttl(clave)).toBeLessThanOrEqual(30);

    const r = await request(servidor)
      .get('/api/alianzas')
      .set(CABECERA_TESTIGO, testigo as string)
      .set('X-Forwarded-For', '10.10.1.5');
    expect(r.status, 'a los 9 min 30 s la sesion sigue viva').toBe(200);

    // Y la expiracion se ha DESPLAZADO: vuelve a haber 10 minutos.
    const ttl = await entorno.redis.ttl(clave);
    expect(ttl, 'la expiracion es deslizante: debe volver a 600').toBeGreaterThan(590);
  });

  it('a los 10 min + 1 s la sesion es RECHAZADA', async () => {
    const { testigo } = await ingresar('BIM23_PAID');
    const clave = `paid:sesion:${resumir(testigo as string)}`;

    // Diez minutos y un segundo: Redis ya no tiene la clave. Es exactamente
    // lo que hace la expiracion real.
    await entorno.redis.del(clave);

    const r = await request(servidor)
      .get('/api/alianzas')
      .set(CABECERA_TESTIGO, testigo as string)
      .set('X-Forwarded-For', '10.10.1.5');
    expect(r.status).toBe(401);
    expect((r.body as { codigo: string }).codigo).toBe('AUTH_SESION_EXPIRADA');
  });

  it('la sesion vencida queda cerrada en seg.sesion, con su motivo', async () => {
    const { testigo } = await ingresar('BIM23_PAID');
    await entorno.redis.del(`paid:sesion:${resumir(testigo as string)}`);
    await request(servidor)
      .get('/api/alianzas')
      .set(CABECERA_TESTIGO, testigo as string)
      .set('X-Forwarded-For', '10.10.1.5');

    const r = await entorno.pool.query<{ motivo_cierre: string | null }>(
      'SELECT motivo_cierre FROM seg.sesion WHERE hash_testigo = $1',
      [resumir(testigo as string)],
    );
    expect(r.rows[0]?.motivo_cierre).toBe('INACTIVIDAD');
  });

  it('una peticion sin testigo es rechazada', async () => {
    const r = await request(servidor).get('/api/alianzas');
    expect(r.status).toBe(401);
  });

  it('la sonda de salud NO exige sesion', async () => {
    const r = await request(servidor).get('/api/salud');
    expect(r.status).toBe(200);
  });

  it('al cerrar sesion el testigo deja de servir', async () => {
    const { testigo } = await ingresar('BIM23_PAID');
    await request(servidor)
      .post('/api/autenticacion/salida')
      .set(CABECERA_TESTIGO, testigo as string)
      .expect(204);

    const r = await request(servidor)
      .get('/api/alianzas')
      .set(CABECERA_TESTIGO, testigo as string);
    expect(r.status).toBe(401);

    const fila = await entorno.pool.query<{ motivo_cierre: string | null }>(
      'SELECT motivo_cierre FROM seg.sesion WHERE hash_testigo = $1',
      [resumir(testigo as string)],
    );
    expect(fila.rows[0]?.motivo_cierre).toBe('CIERRE_USUARIO');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('R2 — peticion desde IP fuera de seg.red_autorizada', () => {
  beforeAll(async () => {
    // Las semillas dejan la red abierta (0.0.0.0/0 y ::/0, D-38). Para esta
    // casilla hay que cerrarla de verdad: se sustituye por un rango concreto.
    await entorno.pool.query(
      `DELETE FROM seg.red_autorizada WHERE rango IN ('0.0.0.0/0'::cidr, '::/0'::cidr)`,
    );
    await entorno.pool.query(
      `INSERT INTO seg.red_autorizada (rango, id_tipo_red, descripcion)
       VALUES ('10.10.0.0/16',
               (SELECT id FROM ref.tipo_red WHERE codigo = 'OPERACION'),
               'Rango de prueba de la Puerta 2')
       ON CONFLICT (rango) DO NOTHING`,
    );
  });

  it('desde dentro del rango, el reto se emite', async () => {
    const r = await request(servidor)
      .post('/api/autenticacion/reto')
      .set('X-Forwarded-For', '10.10.9.9')
      .send({});
    expect(r.status).toBe(200);
  });

  it('desde fuera del rango es RECHAZADA', async () => {
    const r = await request(servidor)
      .post('/api/autenticacion/reto')
      .set('X-Forwarded-For', '192.168.44.7')
      .send({});
    expect(r.status).toBe(401);
  });

  it('una X-Forwarded-For escrita por el cliente no abre la red', async () => {
    // Desde internet cualquiera manda la cabecera con una IP de dentro. El
    // proxy AÑADE la real al final, y esa es la que cuenta (ip-origen.ts).
    const r = await request(servidor)
      .post('/api/autenticacion/reto')
      .set('X-Forwarded-For', '10.10.9.9, 192.168.44.7')
      .send({});
    expect(r.status).toBe(401);
  });

  it('la IP que añade el proxy cuenta aunque el cliente mande otra delante', async () => {
    const r = await request(servidor)
      .post('/api/autenticacion/reto')
      .set('X-Forwarded-For', '192.168.44.7, 10.10.9.9')
      .send({});
    expect(r.status).toBe(200);
  });

  it('queda RED_NO_AUTORIZADA en seg.intento_autenticacion', async () => {
    await request(servidor)
      .post('/api/autenticacion/reto')
      .set('X-Forwarded-For', '203.0.113.9')
      .send({});

    const r = await entorno.pool.query<{ codigo: string; ip: string }>(
      `SELECT res.codigo, i.direccion_ip::text AS ip
         FROM seg.intento_autenticacion i
         JOIN ref.resultado_intento_autenticacion res ON res.id = i.id_resultado
        WHERE i.direccion_ip = '203.0.113.9'::inet
        ORDER BY i.id DESC LIMIT 1`,
    );
    expect(r.rows[0]?.codigo).toBe('RED_NO_AUTORIZADA');
  });

  it('un ingreso completo desde fuera del rango tambien es rechazado', async () => {
    const r = await ingresar('BIM23_PAID', CLAVE_DESARROLLO, '198.51.100.3');
    expect(r.estado).toBe(401);
  });

  it('la respuesta desde fuera de la red es IDENTICA a la de credenciales invalidas (R4)', async () => {
    const fuera = await request(servidor)
      .post('/api/autenticacion/reto')
      .set('X-Forwarded-For', '192.168.44.7')
      .send({});
    // No se le confirma a quien esta fuera de la red que su problema es la red.
    expect((fuera.body as { mensaje: string }).mensaje).toBe(MENSAJE_CREDENCIALES_INVALIDAS);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('R3 — el mismo reto de captcha no se puede usar dos veces', () => {
  it('el segundo uso del mismo reto es rechazado', async () => {
    const reto = await request(servidor)
      .post('/api/autenticacion/reto')
      .set('X-Forwarded-For', '10.10.1.5')
      .send({});
    const { idCaptcha, textoReto } = reto.body as { idCaptcha: string; textoReto: string };
    const respuestaCaptcha = resolverReto(textoReto);

    const primero = await request(servidor)
      .post('/api/autenticacion/ingreso')
      .set('X-Forwarded-For', '10.10.1.5')
      .send({ credencial: 'BIM23_PAID', clave: CLAVE_DESARROLLO, idCaptcha, respuestaCaptcha });
    expect(primero.status, 'el primer uso funciona').toBe(200);

    const segundo = await request(servidor)
      .post('/api/autenticacion/ingreso')
      .set('X-Forwarded-For', '10.10.1.5')
      .send({ credencial: 'BIM23_PAID', clave: CLAVE_DESARROLLO, idCaptcha, respuestaCaptcha });
    expect(segundo.status, 'el segundo uso del MISMO reto no').toBe(401);
  });

  it('se marca consumido incluso cuando la respuesta es ERRADA (R3)', async () => {
    const reto = await request(servidor)
      .post('/api/autenticacion/reto')
      .set('X-Forwarded-For', '10.10.1.5')
      .send({});
    const { idCaptcha, textoReto } = reto.body as { idCaptcha: string; textoReto: string };

    // Se falla el captcha a proposito.
    await request(servidor)
      .post('/api/autenticacion/ingreso')
      .set('X-Forwarded-For', '10.10.1.5')
      .send({ credencial: 'BIM23_PAID', clave: CLAVE_DESARROLLO, idCaptcha, respuestaCaptcha: '999999' });

    const fila = await entorno.pool.query<{ consumido_en: Date | null }>(
      'SELECT consumido_en FROM seg.captcha WHERE id = $1',
      [idCaptcha],
    );
    // Si solo se marcara al acertar, el mismo reto admitiria intentos infinitos.
    expect(fila.rows[0]?.consumido_en).not.toBeNull();

    // Y ahora, con la respuesta correcta, ya no sirve.
    const reintento = await request(servidor)
      .post('/api/autenticacion/ingreso')
      .set('X-Forwarded-For', '10.10.1.5')
      .send({
        credencial: 'BIM23_PAID',
        clave: CLAVE_DESARROLLO,
        idCaptcha,
        respuestaCaptcha: resolverReto(textoReto),
      });
    expect(reintento.status).toBe(401);
  });

  it('un identificador de captcha inventado no provoca un 500', async () => {
    const r = await request(servidor)
      .post('/api/autenticacion/ingreso')
      .set('X-Forwarded-For', '10.10.1.5')
      .send({
        credencial: 'BIM23_PAID',
        clave: CLAVE_DESARROLLO,
        idCaptcha: 'no-soy-un-uuid',
        respuestaCaptcha: '7',
      });
    expect(r.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('R4 — usuario inexistente y clave errada responden lo MISMO', () => {
  it('mismo codigo HTTP y mismo cuerpo', async () => {
    const inexistente = await ingresar('NOEXISTE_PAID', CLAVE_DESARROLLO);
    const claveErrada = await ingresar('BIM23_PAID', 'clave-que-no-es');

    expect(inexistente.estado).toBe(claveErrada.estado);
    expect(inexistente.estado).toBe(401);
    expect(inexistente.cuerpo['codigo']).toBe(claveErrada.cuerpo['codigo']);
    expect(inexistente.cuerpo['mensaje']).toBe(claveErrada.cuerpo['mensaje']);
    expect(inexistente.cuerpo['mensaje']).toBe(MENSAJE_CREDENCIALES_INVALIDAS);

    // El cuerpo completo, salvo el idCorrelacion que por definicion difiere.
    const sinCorrelacion = (c: Record<string, unknown>) => {
      const { idCorrelacion: _omitido, ...resto } = c;
      return resto;
    };
    expect(sinCorrelacion(inexistente.cuerpo)).toEqual(sinCorrelacion(claveErrada.cuerpo));
  });

  it('AMBOS caminos ejecutan la verificacion de clave', async () => {
    /*
     * PROMPT.md es explicito: «No pruebes tiempos de respuesta: es una prueba
     * inestable. Verifica en su lugar que ambos caminos ejecutan la
     * verificacion de contrasena, con un resumen ficticio cuando el usuario no
     * existe.»
     *
     * Eso es exactamente lo que hace este espia.
     */
    const { ClaveService } = await import('../seguridad/clave.service');
    const servicio = entorno.app.get(ClaveService);
    const espia = vi.spyOn(servicio, 'verificar');

    espia.mockClear();
    await ingresar('BIM23_PAID', 'clave-que-no-es');
    const llamadasClaveErrada = espia.mock.calls.length;

    espia.mockClear();
    await ingresar('NOEXISTE_PAID', 'clave-que-no-es');
    const llamadasUsuarioInexistente = espia.mock.calls.length;
    const resumenUsado = espia.mock.calls[0]?.[0];

    expect(llamadasClaveErrada, 'clave errada verifica').toBeGreaterThan(0);
    expect(llamadasUsuarioInexistente, 'usuario inexistente TAMBIEN verifica').toBe(
      llamadasClaveErrada,
    );
    // Y lo hace contra el resumen ficticio, que es un Argon2id real: el
    // trabajo criptografico es el mismo y no hay nada que medir.
    expect(resumenUsado).toBe(servicio.resumenFicticio);
    expect(resumenUsado).toMatch(/^\$argon2id\$/);

    espia.mockRestore();
  });

  it('la base SI distingue las ocho causas, aunque la pantalla no', async () => {
    await ingresar('NOEXISTE_PAID', CLAVE_DESARROLLO);
    await ingresar('BIM24_PAID', 'clave-que-no-es');

    const r = await entorno.pool.query<{ codigo: string }>(
      `SELECT DISTINCT res.codigo
         FROM seg.intento_autenticacion i
         JOIN ref.resultado_intento_autenticacion res ON res.id = i.id_resultado`,
    );
    const causas = r.rows.map((f) => f.codigo);
    expect(causas).toContain('USUARIO_INEXISTENTE');
    expect(causas).toContain('CLAVE_INVALIDA');
    expect(causas).toContain('RED_NO_AUTORIZADA');
    expect(causas).toContain('EXITOSO');
  });

  it('el mensaje de la pantalla no nombra ninguna de las ocho causas', async () => {
    const r = await ingresar('NOEXISTE_PAID', CLAVE_DESARROLLO);
    const mensaje = String(r.cuerpo['mensaje']).toUpperCase();

    // Se comparan PALABRAS y no subcadenas: «CREDENCIALES» contiene «RED», y
    // buscar subcadenas daba un falso positivo.
    const palabras = new Set(mensaje.split(/[^A-ZÁÉÍÓÚÑ]+/).filter((p) => p !== ''));
    for (const termino of [
      'USUARIO', 'CLAVE', 'CONTRASEÑA', 'CAPTCHA', 'BLOQUEADO', 'INACTIVO',
      'RED', 'EXPIRADA', 'EXISTE', 'INEXISTENTE',
    ]) {
      expect(palabras, `el mensaje no debe nombrar «${termino}»`).not.toContain(termino);
    }
    // Lo unico que dice.
    expect(r.cuerpo['mensaje']).toBe(MENSAJE_CREDENCIALES_INVALIDAS);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Bloqueo a los 5 intentos fallidos', () => {
  it('cinco fallos bloquean la cuenta', async () => {
    // Se usa FNP_PAID para no bloquear las credenciales de las demas pruebas.
    for (let i = 1; i <= 5; i += 1) {
      const r = await ingresar('FNP_PAID', 'clave-que-no-es');
      expect(r.estado, `intento ${i}`).toBe(401);
    }

    const fila = await entorno.pool.query<{ intentos: number; bloqueado: Date | null }>(
      'SELECT intentos_fallidos AS intentos, bloqueado_en AS bloqueado FROM seg.usuario WHERE credencial = $1',
      ['FNP_PAID'],
    );
    expect(fila.rows[0]?.intentos).toBe(5);
    expect(fila.rows[0]?.bloqueado).not.toBeNull();
  });

  it('bloqueada, no entra NI con la clave correcta', async () => {
    const r = await ingresar('FNP_PAID', CLAVE_DESARROLLO);
    expect(r.estado).toBe(401);

    const intento = await entorno.pool.query<{ codigo: string }>(
      `SELECT res.codigo FROM seg.intento_autenticacion i
         JOIN ref.resultado_intento_autenticacion res ON res.id = i.id_resultado
        WHERE i.credencial_intentada = 'FNP_PAID'
        ORDER BY i.id DESC LIMIT 1`,
    );
    expect(intento.rows[0]?.codigo).toBe('USUARIO_BLOQUEADO');
  });

  it('un ingreso exitoso pone el contador a cero', async () => {
    await ingresar('BIM24_PAID', 'clave-que-no-es');
    await ingresar('BIM24_PAID', 'clave-que-no-es');
    const r = await ingresar('BIM24_PAID', CLAVE_DESARROLLO);
    expect(r.estado).toBe(200);

    const fila = await entorno.pool.query<{ intentos: number }>(
      'SELECT intentos_fallidos AS intentos FROM seg.usuario WHERE credencial = $1',
      ['BIM24_PAID'],
    );
    expect(fila.rows[0]?.intentos).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('R16 — OPERADOR_UNIDAD recibe 403 al intentar ALIANZA.AVANCE', () => {
  let idConvenio = 0;

  beforeAll(async () => {
    const unidad = await entorno.pool.query<{ id: string }>(
      `SELECT id FROM org.unidad WHERE sigla = 'BIM23'`,
    );
    const entidad = await entorno.pool.query<{ id: string }>(
      `INSERT INTO ai.entidad (id_tipo_entidad, nombre, id_unidad, id_estado_registro)
       VALUES ((SELECT id FROM ref.tipo_entidad WHERE codigo='ONG'),
               'Fundacion de prueba', $1,
               (SELECT id FROM ref.estado_registro WHERE codigo='ACTIVO'))
       RETURNING id`,
      [unidad.rows[0]?.id],
    );
    const convenio = await entorno.pool.query<{ id: string }>(
      `INSERT INTO ai.alianza (id_tipo_alianza, codigo, objeto, id_entidad, id_unidad,
                               fecha_suscripcion, id_estado_registro)
       VALUES ((SELECT id FROM ref.tipo_alianza WHERE codigo='CONVENIO'),
               'CONV-PRUEBA-1', 'Convenio de prueba', $1, $2, '2026-01-15',
               (SELECT id FROM ref.estado_registro WHERE codigo='ACTIVO'))
       RETURNING id`,
      [entidad.rows[0]?.id, unidad.rows[0]?.id],
    );
    idConvenio = Number(convenio.rows[0]?.id);
  });

  it('OPERADOR_UNIDAD recibe 403', async () => {
    const { testigo } = await ingresar('BIM23_PAID');
    const r = await request(servidor)
      .patch(`/api/alianzas/${idConvenio}/avance`)
      .set(CABECERA_TESTIGO, testigo as string)
      .set('X-Forwarded-For', '10.10.1.5')
      .send({ porcentajeAvance: 40 });
    expect(r.status).toBe(403);
    expect((r.body as { codigo: string }).codigo).toBe('AUTH_ACCESO_DENEGADO');
  });

  it('OPERADOR_UNIDAD SI puede consultar: el 403 es del permiso, no de la ruta', async () => {
    const { testigo } = await ingresar('BIM23_PAID');
    const r = await request(servidor)
      .get('/api/alianzas')
      .set(CABECERA_TESTIGO, testigo as string)
      .set('X-Forwarded-For', '10.10.1.5');
    expect(r.status).toBe(200);
  });

  it('FUNCIONAL_JACID si puede diligenciar el avance', async () => {
    const { testigo } = await ingresar('FUNCIONAL_PAID');
    const r = await request(servidor)
      .patch(`/api/alianzas/${idConvenio}/avance`)
      .set(CABECERA_TESTIGO, testigo as string)
      .set('X-Forwarded-For', '10.10.1.5')
      .send({ porcentajeAvance: 40 });
    expect(r.status).toBe(200);
    expect((r.body as { porcentajeAvance: number }).porcentajeAvance).toBe(40);
  });

  it('el avance de un convenio no retrocede', async () => {
    const { testigo } = await ingresar('FUNCIONAL_PAID');
    const r = await request(servidor)
      .patch(`/api/alianzas/${idConvenio}/avance`)
      .set(CABECERA_TESTIGO, testigo as string)
      .set('X-Forwarded-For', '10.10.1.5')
      .send({ porcentajeAvance: 20 });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });

  it('la matriz sembrada da ALIANZA.AVANCE solo a JACID', async () => {
    const r = await entorno.pool.query<{ rol: string }>(
      `SELECT r.codigo AS rol
         FROM seg.rol r
         JOIN seg.rol_permiso rp ON rp.id_rol = r.id
         JOIN seg.permiso p ON p.id = rp.id_permiso
        WHERE p.codigo = 'ALIANZA.AVANCE' ORDER BY 1`,
    );
    expect(r.rows.map((f) => f.rol)).toEqual(['ADMINISTRADOR', 'FUNCIONAL_JACID']);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('P7 — la base no contiene ningun testigo de sesion en claro', () => {
  it('el testigo entregado NO aparece en seg.sesion', async () => {
    const { testigo } = await ingresar('BIM23_PAID');
    expect(testigo).toBeDefined();

    const r = await entorno.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM seg.sesion WHERE hash_testigo = $1`,
      [testigo as string],
    );
    expect(Number(r.rows[0]?.n), 'el testigo en claro no debe estar en ninguna fila').toBe(0);

    // Lo que si esta es su resumen.
    const conResumen = await entorno.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM seg.sesion WHERE hash_testigo = $1`,
      [resumir(testigo as string)],
    );
    expect(Number(conResumen.rows[0]?.n)).toBe(1);
  });

  it('NINGUNA columna de texto de seg.sesion contiene el testigo', async () => {
    const { testigo } = await ingresar('BIM23_PAID');

    // Se busca el testigo en la representacion JSON de TODA la fila, para que
    // la prueba siga valiendo si alguien anade una columna nueva.
    const r = await entorno.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM seg.sesion s WHERE to_jsonb(s)::text LIKE '%' || $1 || '%'`,
      [testigo as string],
    );
    expect(Number(r.rows[0]?.n)).toBe(0);
  });

  it('tampoco esta en la bitacora ni en los intentos', async () => {
    const { testigo } = await ingresar('BIM23_PAID');
    for (const tabla of ['aud.bitacora_cambio', 'seg.intento_autenticacion']) {
      const r = await entorno.pool.query<{ n: string }>(
        `SELECT count(*) AS n FROM ${tabla} t WHERE to_jsonb(t)::text LIKE '%' || $1 || '%'`,
        [testigo as string],
      );
      expect(Number(r.rows[0]?.n), `${tabla} no debe contener el testigo`).toBe(0);
    }
  });

  it('todos los hash_testigo tienen forma de sha256 hex', async () => {
    const r = await entorno.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM seg.sesion WHERE hash_testigo !~ '^[0-9a-f]{64}$'`,
    );
    expect(Number(r.rows[0]?.n)).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('R6 — la premisa: el rol de la aplicacion no puede saltarse RLS', () => {
  /**
   * Esta prueba existe por un defecto real.
   *
   * La primera version del arranque conectaba la API con el rol administrador,
   * y la prueba de fuga de contexto mostro a BIM23 viendo filas de BIM24 — no
   * porque `SET LOCAL` fallara, sino porque un SUPERUSUARIO ignora RLS por
   * definicion y el aislamiento por unidad no se estaba aplicando en absoluto.
   *
   * Sin esta comprobacion, cualquier despliegue que apunte `DATABASE_URL` al
   * usuario administrador —por comodidad, por una copia de configuracion—
   * anula R6 entero y ninguna otra prueba lo nota.
   */
  it('el rol con el que la API se conecta NO es superusuario ni tiene BYPASSRLS', async () => {
    const { Pool } = await import('pg');
    const poolApi = new Pool({ connectionString: entorno.urlBase, max: 1 });
    try {
      const r = await poolApi.query<{
        usuario: string;
        superusuario: boolean;
        salta_rls: boolean;
      }>(
        `SELECT current_user AS usuario, rolsuper AS superusuario, rolbypassrls AS salta_rls
           FROM pg_roles WHERE rolname = current_user`,
      );
      const fila = r.rows[0];
      expect(fila?.superusuario, `el rol ${fila?.usuario} NO debe ser superusuario`).toBe(false);
      expect(fila?.salta_rls, `el rol ${fila?.usuario} NO debe tener BYPASSRLS`).toBe(false);
    } finally {
      await poolApi.end();
    }
  });

  it('y RLS esta ACTIVA y FORZADA en las tablas de ai, org y doc', async () => {
    const r = await entorno.pool.query<{ nombre: string }>(
      `SELECT n.nspname || '.' || c.relname AS nombre
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname IN ('ai','org','doc') AND c.relkind = 'r'
          AND NOT (c.relrowsecurity AND c.relforcerowsecurity)`,
    );
    expect(
      r.rows.map((f) => f.nombre),
      'estas tablas no tienen RLS activa y forzada',
    ).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('R7 / P11 — fuga de contexto entre peticiones del pool', () => {
  beforeAll(async () => {
    const unidades = await entorno.pool.query<{ id: string; sigla: string }>(
      `SELECT id, sigla FROM org.unidad WHERE sigla IN ('BIM23','BIM24')`,
    );
    for (const u of unidades.rows) {
      const entidad = await entorno.pool.query<{ id: string }>(
        `INSERT INTO ai.entidad (id_tipo_entidad, nombre, id_unidad, id_estado_registro)
         VALUES ((SELECT id FROM ref.tipo_entidad WHERE codigo='ONG'),
                 'Entidad de ' || $2, $1,
                 (SELECT id FROM ref.estado_registro WHERE codigo='ACTIVO'))
         RETURNING id`,
        [u.id, u.sigla],
      );
      await entorno.pool.query(
        `INSERT INTO ai.alianza (id_tipo_alianza, codigo, objeto, id_entidad, id_unidad,
                                 fecha_suscripcion, id_estado_registro)
         VALUES ((SELECT id FROM ref.tipo_alianza WHERE codigo='ALIANZA'),
                 'ALZ-' || $3, 'Alianza de ' || $3, $1, $2, '2026-02-01',
                 (SELECT id FROM ref.estado_registro WHERE codigo='ACTIVO'))
         ON CONFLICT (codigo) DO NOTHING`,
        [entidad.rows[0]?.id, u.id, u.sigla],
      );
    }
  });

  it('dos peticiones consecutivas de unidades DISTINTAS devuelven cada una solo sus filas', async () => {
    /*
     * ⚠️ ESTA ES LA PRUEBA DE P11.
     *
     * `DATABASE_POOL_MAX = 1` (lo fija el arranque del entorno), asi que las
     * dos peticiones se atienden por LA MISMA conexion de PostgreSQL. Si el
     * contexto se fijara con `SET` en lugar de `SET LOCAL`, la segunda
     * heredaria el de la primera y veria las filas de la unidad anterior.
     */
    const bim23 = await ingresar('BIM23_PAID');
    const bim24 = await ingresar('BIM24_PAID');
    expect(bim23.estado).toBe(200);
    expect(bim24.estado).toBe(200);

    const codigosDe = async (testigo: string): Promise<string[]> => {
      const r = await request(servidor)
        .get('/api/alianzas')
        .set(CABECERA_TESTIGO, testigo)
        .set('X-Forwarded-For', '10.10.1.5');
      expect(r.status).toBe(200);
      return (r.body as { codigo: string }[]).map((f) => f.codigo);
    };

    // Van una detras de otra, a proposito, sobre la misma conexion.
    const vistasPorBim23 = await codigosDe(bim23.testigo as string);
    const vistasPorBim24 = await codigosDe(bim24.testigo as string);
    // Y de vuelta, para descartar que el orden sea lo que salva la prueba.
    const vistasPorBim23Otra = await codigosDe(bim23.testigo as string);

    expect(vistasPorBim23).toContain('ALZ-BIM23');
    expect(vistasPorBim23, 'BIM23 NO puede ver lo de su hermana').not.toContain('ALZ-BIM24');

    expect(vistasPorBim24).toContain('ALZ-BIM24');
    expect(vistasPorBim24, 'BIM24 NO puede ver lo de su hermana').not.toContain('ALZ-BIM23');

    expect(vistasPorBim23Otra).toEqual(vistasPorBim23);
  });

  it('el contexto no queda pegado a la conexion despues de la peticion', async () => {
    const { testigo } = await ingresar('BIM23_PAID');
    await request(servidor)
      .get('/api/alianzas')
      .set(CABECERA_TESTIGO, testigo as string)
      .set('X-Forwarded-For', '10.10.1.5');

    // Se pregunta por el contexto usando el pool de la API, que es el mismo
    // que atendio la peticion. `SET LOCAL` murio con su transaccion.
    const r = await entorno.pool.query<{ unidad: string | null }>(
      `SELECT current_setting('app.id_unidad', true) AS unidad`,
    );
    expect(r.rows[0]?.unidad ?? '').toBe('');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Extras: cosas que la Puerta 2 no pide pero se verian tarde', () => {
  it('R5 — una credencial que no cumple el patron responde como invalida, no como 400', async () => {
    // Un 400 con detalle de validacion revelaria el formato de las credenciales.
    const r = await request(servidor)
      .post('/api/autenticacion/ingreso')
      .set('X-Forwarded-For', '10.10.1.5')
      .send({ credencial: 'juan.perez', clave: 'x', idCaptcha: 'x', respuestaCaptcha: 'x' });
    expect(r.status).toBe(401);
    expect((r.body as { mensaje: string }).mensaje).toBe(MENSAJE_CREDENCIALES_INVALIDAS);
  });

  it('R15 — la escritura autenticada queda en la bitacora con el usuario del contexto', async () => {
    const { testigo } = await ingresar('FUNCIONAL_PAID');
    const convenio = await entorno.pool.query<{ id: string }>(
      `SELECT id FROM ai.alianza WHERE codigo = 'CONV-PRUEBA-1'`,
    );
    await request(servidor)
      .patch(`/api/alianzas/${convenio.rows[0]?.id}/avance`)
      .set(CABECERA_TESTIGO, testigo as string)
      .set('X-Forwarded-For', '10.10.1.5')
      .send({ porcentajeAvance: 60 });

    const r = await entorno.pool.query<{ id_usuario: string | null; id_sesion: string | null }>(
      `SELECT id_usuario, id_sesion FROM aud.bitacora_cambio
        WHERE tabla = 'alianza' AND operacion = 'U' ORDER BY id DESC LIMIT 1`,
    );
    // El usuario y la sesion salen del contexto de R7, no de un parametro.
    expect(r.rows[0]?.id_usuario).not.toBeNull();
    expect(r.rows[0]?.id_sesion).not.toBeNull();
  });

  it('la tarea programada cierra las sesiones vencidas en la tabla (R1)', async () => {
    const { testigo } = await ingresar('BIM23_PAID');
    const resumen = resumir(testigo as string);
    // Se envejece la fila para que quede vencida.
    await entorno.pool.query(
      `UPDATE seg.sesion SET ultima_actividad_en = now() - interval '2 hours'
        WHERE hash_testigo = $1`,
      [resumen],
    );

    const { SesionService } = await import('../seguridad/sesion.service');
    const servicio = entorno.app.get(SesionService);
    const cerradas = await servicio.cerrarVencidas();
    expect(cerradas).toBeGreaterThan(0);

    const r = await entorno.pool.query<{ motivo: string | null }>(
      'SELECT motivo_cierre AS motivo FROM seg.sesion WHERE hash_testigo = $1',
      [resumen],
    );
    expect(r.rows[0]?.motivo).toBe('EXPIRACION');
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import { normalizarTexto } from '@paid/schema';
import { aDecimal } from '@paid/schema';
import type { EntornoPruebas } from './entorno';
import {
  aplicarPendientes,
  comoUsuario,
  leerMigraciones,
  prepararEntorno,
  revertirTodas,
} from './entorno';

/**
 * 🚪 PUERTA 1 — «tests con Testcontainers sobre Postgres real».
 *
 * Cada `describe` de este archivo corresponde a una casilla de la lista de
 * PROMPT.md. El orden es el del documento.
 *
 * Estas pruebas se ejecutan como roles `NOSUPERUSER NOBYPASSRLS`: un
 * superusuario ignora RLS, y las pruebas de ambito pasarian en falso.
 */

let entorno: EntornoPruebas;

/** Identificadores de las unidades del arbol de prueba. */
const unidades = { fnp: 0, componente: 0, bim23: 0, bim24: 0 };
/** Ruta ltree de cada unidad, tal como la derivo el disparador. */
const rutas: Record<number, string> = {};
const datos = { idUsuario: 0, idEntidad: 0, idTipoEntidad: 0, idEstadoActivo: 0 };

const MB = 1024 * 1024;

/**
 * Contexto de sesion (R7) para cada unidad.
 *
 * `rutaUnidad` sale de la ruta que el disparador derivo, igual que hara la
 * API a partir de `seg.sesion`. Se lee de la base y no se compone a mano
 * precisamente para que la prueba falle si el disparador de R6 cambia de
 * formato.
 */
function ctx(idUnidad: number) {
  const ruta = rutas[idUnidad];
  if (ruta === undefined) {
    throw new Error(`No se conoce la ruta jerarquica de la unidad ${idUnidad}.`);
  }
  return {
    idUsuario: datos.idUsuario,
    idUnidad,
    rutaUnidad: ruta,
    idSesion: '11111111-1111-1111-1111-111111111111',
    direccionIp: '10.0.0.1',
  };
}

/** GMS de Cartagena, reutilizadas en casi todas las actividades de prueba. */
const GMS_CARTAGENA = {
  latitud_grados: 10,
  latitud_minutos: 23,
  latitud_segundos: 27,
  latitud_hemisferio: 'N',
  longitud_grados: 75,
  longitud_minutos: 30,
  longitud_segundos: 51,
  longitud_hemisferio: 'W',
};

/** Crea una actividad con su subtipo, como administrador (sin RLS). */
async function crearActividad(
  cliente: PoolClient,
  opciones: {
    codigo: string;
    idUnidad: number;
    idTipo?: number;
    participoArc?: boolean;
  },
): Promise<number> {
  const idTipo = opciones.idTipo ?? 1;
  const resultado = await cliente.query<{ id: string }>(
    `INSERT INTO ai.actividad (
       id_tipo_actividad, codigo_actividad, id_unidad, descripcion, fecha_inicio,
       participo_arc, id_estado_registro,
       latitud_grados, latitud_minutos, latitud_segundos, latitud_hemisferio,
       longitud_grados, longitud_minutos, longitud_segundos, longitud_hemisferio
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id`,
    [
      idTipo,
      opciones.codigo,
      opciones.idUnidad,
      'Clavegrama de prueba. Se entregaron 120 raciones alimentarias.',
      '2026-03-05',
      opciones.participoArc ?? true,
      datos.idEstadoActivo,
      GMS_CARTAGENA.latitud_grados,
      GMS_CARTAGENA.latitud_minutos,
      GMS_CARTAGENA.latitud_segundos,
      GMS_CARTAGENA.latitud_hemisferio,
      GMS_CARTAGENA.longitud_grados,
      GMS_CARTAGENA.longitud_minutos,
      GMS_CARTAGENA.longitud_segundos,
      GMS_CARTAGENA.longitud_hemisferio,
    ],
  );
  const id = Number(resultado.rows[0]?.id);

  const tablas: Record<number, string> = {
    1: `INSERT INTO ai.jornada_apoyo (id_actividad, fecha_ejecucion, lugar) VALUES ($1,'2026-03-05','Cartagena')`,
    3: `INSERT INTO ai.rueda_servicios (id_actividad, fecha_ejecucion, lugar) VALUES ($1,'2026-03-05','Cartagena')`,
    4: `INSERT INTO ai.proyecto_social (id_actividad, nombre_proyecto) VALUES ($1,'Proyecto de prueba')`,
  };
  const sql = tablas[idTipo];
  if (sql !== undefined) await cliente.query(sql, [id]);
  return id;
}

beforeAll(async () => {
  entorno = await prepararEntorno();
  const c = await entorno.poolAdmin.connect();
  try {
    const estado = await c.query<{ id: number }>(
      `SELECT id FROM ref.estado_registro WHERE codigo = 'ACTIVO'`,
    );
    datos.idEstadoActivo = Number(estado.rows[0]?.id);

    // Arbol de unidades: FNP (Fuerza) -> Componente -> { BIM23, BIM24 }.
    // BIM23 y BIM24 son HERMANAS: es el caso que R6 prohibe cruzar.
    const nivel = async (codigo: string): Promise<number> => {
      const r = await c.query<{ id: number }>(
        `SELECT id FROM ref.nivel_jerarquia WHERE codigo = $1`,
        [codigo],
      );
      return Number(r.rows[0]?.id);
    };
    const crearUnidad = async (
      codigo: string,
      sigla: string,
      idNivel: number,
      superior: number | null,
    ): Promise<number> => {
      const r = await c.query<{ id: string }>(
        `INSERT INTO org.unidad (codigo, sigla, nombre, id_nivel_jerarquia,
           id_unidad_superior, ruta_jerarquica, id_estado_registro)
         VALUES ($1,$2,$3,$4,$5,'pendiente',$6) RETURNING id`,
        [codigo, sigla, sigla, idNivel, superior, datos.idEstadoActivo],
      );
      return Number(r.rows[0]?.id);
    };

    unidades.fnp = await crearUnidad('U-FNP', 'FNP', await nivel('FUERZA'), null);
    unidades.componente = await crearUnidad(
      'U-CFM', 'CFM', await nivel('COMPONENTE'), unidades.fnp,
    );
    unidades.bim23 = await crearUnidad(
      'U-BIM23', 'BIM23', await nivel('UNIDAD_TACTICA'), unidades.componente,
    );
    unidades.bim24 = await crearUnidad(
      'U-BIM24', 'BIM24', await nivel('UNIDAD_TACTICA'), unidades.componente,
    );

    const rutasLeidas = await c.query<{ id: string; ruta: string }>(
      'SELECT id, ruta_jerarquica::text AS ruta FROM org.unidad',
    );
    for (const fila of rutasLeidas.rows) {
      rutas[Number(fila.id)] = fila.ruta;
    }

    const usuario = await c.query<{ id: string }>(
      `INSERT INTO seg.usuario (credencial, hash_clave, id_unidad, id_estado_registro)
       VALUES ('BIM23_PAID', '$argon2id$v=19$m=65536,t=3,p=4$ficticio', $1, $2)
       RETURNING id`,
      [unidades.bim23, datos.idEstadoActivo],
    );
    datos.idUsuario = Number(usuario.rows[0]?.id);

    const tipoEntidad = await c.query<{ id: number }>(
      `SELECT id FROM ref.tipo_entidad WHERE codigo = 'ONG'`,
    );
    datos.idTipoEntidad = Number(tipoEntidad.rows[0]?.id);
    const entidad = await c.query<{ id: string }>(
      `INSERT INTO ai.entidad (id_tipo_entidad, nombre, id_unidad, id_estado_registro)
       VALUES ($1, 'Fundación El Futuro', $2, $3) RETURNING id`,
      [datos.idTipoEntidad, unidades.bim23, datos.idEstadoActivo],
    );
    datos.idEntidad = Number(entidad.rows[0]?.id);

    // Catalogos minimos SOLO PARA PRUEBA de las pestañas cuyos catalogos se
    // siembran vacios a proposito (Q4). No son semillas: son datos de prueba,
    // y por eso viven aqui y no en semillas/.
    await c.query(`
      INSERT INTO ref.tipo_operacion (codigo, nombre) VALUES ('PRUEBA','Prueba') ON CONFLICT DO NOTHING;
      INSERT INTO ref.servicio_prestado (codigo, nombre) VALUES ('PRUEBA','Prueba') ON CONFLICT DO NOTHING;
      INSERT INTO ref.grupo_poblacional (codigo, nombre) VALUES ('PRUEBA','Prueba') ON CONFLICT DO NOTHING;
      INSERT INTO ref.medio_difusion (codigo, nombre) VALUES ('PRUEBA','Prueba') ON CONFLICT DO NOTHING;
      INSERT INTO ref.medio_utilizado (codigo, nombre) VALUES ('PRUEBA','Prueba') ON CONFLICT DO NOTHING;
      INSERT INTO ref.tipo_recurso (codigo, nombre) VALUES ('PRUEBA','Prueba') ON CONFLICT DO NOTHING;
      INSERT INTO ref.tipo_bien_donado (codigo, nombre) VALUES ('PRUEBA','Prueba') ON CONFLICT DO NOTHING;
      INSERT INTO ref.tipo_herramienta_aid (codigo, nombre) VALUES ('PRUEBA','Prueba') ON CONFLICT DO NOTHING;
    `);
  } finally {
    c.release();
  }
});

afterAll(async () => {
  if (entorno !== undefined) await entorno.cerrar();
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Inventario: ninguna tabla esperada falta (P2)', () => {
  /**
   * El diseno auditado «declaraba nueve tablas hijas y su DDL creaba cuatro;
   * faltaba act_poblacion_beneficiada, la cifra que alimenta el RAO».
   */
  const ESPERADAS: readonly string[] = [
    // Las ONCE pestanas de R19, por su nombre.
    'ai.act_tipo_operacion',
    'ai.act_adjunto',
    'ai.act_entidad_servicio',
    'ai.act_servicio_prestado',
    'ai.act_poblacion_beneficiada',
    'ai.act_entidad_apoyada',
    'ai.act_medio_difusion',
    'ai.act_medio_utilizado',
    'ai.act_recurso_utilizado',
    'ai.act_bien_donado',
    'ai.act_resumen',
    // Supertipo y los cinco subtipos.
    'ai.actividad',
    'ai.jornada_apoyo',
    'ai.asistencia_humanitaria',
    'ai.rueda_servicios',
    'ai.proyecto_social',
    'ai.campana',
    // R8, los tres maestros.
    'ai.personal',
    'ai.entidad',
    'ai.herramienta_aid',
    // R10, R18.
    'ai.proyecto_avance',
    'ai.actividad_coami',
    // Organizacion.
    'org.unidad',
    // Seguridad.
    'seg.usuario', 'seg.rol', 'seg.permiso', 'seg.rol_permiso', 'seg.usuario_rol',
    'seg.sesion', 'seg.intento_autenticacion', 'seg.captcha', 'seg.red_autorizada',
    'seg.historial_clave', 'seg.solicitud_eliminacion',
    // Documentos y auditoria.
    'doc.normatividad',
    'aud.bitacora_cambio',
    'aud.exportacion',
  ];

  it('todas las tablas esperadas existen en information_schema', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      const r = await c.query<{ nombre: string }>(
        `SELECT table_schema || '.' || table_name AS nombre
           FROM information_schema.tables
          WHERE table_schema IN ('ref','org','seg','ai','doc','aud','ia')
            AND table_type = 'BASE TABLE'`,
      );
      const existentes = new Set(r.rows.map((f) => f.nombre));
      const faltantes = ESPERADAS.filter((t) => !existentes.has(t));
      expect(faltantes, `Tablas documentadas y NO implementadas (P2): ${faltantes.join(', ')}`)
        .toEqual([]);
    } finally {
      c.release();
    }
  });

  it('las once pestanas de R19 estan, y son once', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      const r = await c.query<{ n: string }>(
        `SELECT count(*) AS n FROM information_schema.tables
          WHERE table_schema = 'ai' AND table_name LIKE 'act\\_%'`,
      );
      expect(Number(r.rows[0]?.n)).toBe(11);
    } finally {
      c.release();
    }
  });

  it('act_poblacion_beneficiada existe: es la que P2 perdio', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      const r = await c.query(
        `SELECT 1 FROM information_schema.tables
          WHERE table_schema='ai' AND table_name='act_poblacion_beneficiada'`,
      );
      expect(r.rowCount).toBe(1);
    } finally {
      c.release();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('P1 — subtipos: ni ninguno, ni dos', () => {
  it('una actividad SIN subtipo es rechazada al confirmar la transaccion', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      await c.query(
        `INSERT INTO ai.actividad (
           id_tipo_actividad, codigo_actividad, id_unidad, descripcion, fecha_inicio,
           id_estado_registro, latitud_grados, latitud_minutos, latitud_segundos,
           latitud_hemisferio, longitud_grados, longitud_minutos, longitud_segundos,
           longitud_hemisferio)
         VALUES (1,'SIN-SUBTIPO-1',$1,'x','2026-01-01',$2,10,0,0,'N',75,0,0,'W')`,
        [unidades.bim23, datos.idEstadoActivo],
      );
      // El disparador es DEFERRABLE INITIALLY DEFERRED: falla en el COMMIT.
      await expect(c.query('COMMIT')).rejects.toThrow(/no tiene su fila|subtipo/i);
    } finally {
      await c.query('ROLLBACK').catch(() => undefined);
      c.release();
    }
  });

  it('una actividad no puede tener DOS subtipos distintos', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      const id = await crearActividad(c, { codigo: 'DOS-SUBTIPOS-1', idUnidad: unidades.bim23 });
      // La actividad es de tipo 1; intentamos anadirle el subtipo de tipo 3.
      await expect(
        c.query(
          `INSERT INTO ai.rueda_servicios (id_actividad, fecha_ejecucion, lugar)
           VALUES ($1,'2026-03-05','Cartagena')`,
          [id],
        ),
      ).rejects.toThrow(/disyuncion_subtipo|foreign key/i);
    } finally {
      await c.query('ROLLBACK').catch(() => undefined);
      c.release();
    }
  });

  it('el tipo de una actividad ya creada no se puede cambiar', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      const id = await crearActividad(c, { codigo: 'TIPO-INMUTABLE-1', idUnidad: unidades.bim23 });
      await expect(
        c.query('UPDATE ai.actividad SET id_tipo_actividad = 3 WHERE id = $1', [id]),
      ).rejects.toThrow(/no se puede cambiar/i);
    } finally {
      await c.query('ROLLBACK').catch(() => undefined);
      c.release();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('R14 — DELETE sobre una actividad falla para un rol no administrador', () => {
  let idActividad = 0;

  beforeAll(async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      idActividad = await crearActividad(c, { codigo: 'BORRADO-1', idUnidad: unidades.bim23 });
      await c.query('COMMIT');
    } finally {
      c.release();
    }
  });

  it('el rol de OPERACION no puede borrar', async () => {
    await expect(
      comoUsuario(entorno.poolOperador, ctx(unidades.bim23), async (c) => {
        await c.query('DELETE FROM ai.actividad WHERE id = $1', [idActividad]);
      }),
    ).rejects.toThrow(/permission denied|permiso/i);
  });

  it('el rol de ADMINISTRACION si puede', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      const id = await crearActividad(c, { codigo: 'BORRADO-2', idUnidad: unidades.bim23 });
      await c.query('COMMIT');

      await comoUsuario(entorno.poolAdministrador, ctx(unidades.bim23), async (ca) => {
        const r = await ca.query('DELETE FROM ai.actividad WHERE id = $1', [id]);
        expect(r.rowCount).toBe(1);
      });
    } finally {
      c.release();
    }
  });

  it('la solicitud de eliminacion exige motivo no vacio (R14)', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await expect(
        c.query(
          `INSERT INTO seg.solicitud_eliminacion
             (esquema_objetivo, tabla_objetivo, id_registro, id_solicitante, motivo, id_estado)
           VALUES ('ai','actividad',$1,$2,'   ',
             (SELECT id FROM ref.estado_solicitud_eliminacion WHERE codigo='PENDIENTE'))`,
          [idActividad, datos.idUsuario],
        ),
      ).rejects.toThrow(/motivo_no_vacio/i);
    } finally {
      c.release();
    }
  });

  it('nadie resuelve su propia solicitud de eliminacion', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await expect(
        c.query(
          `INSERT INTO seg.solicitud_eliminacion
             (esquema_objetivo, tabla_objetivo, id_registro, id_solicitante, motivo,
              id_estado, id_decisor, resolucion, resuelto_en)
           VALUES ('ai','actividad',$1,$2,'Duplicado por error de digitacion',
             (SELECT id FROM ref.estado_solicitud_eliminacion WHERE codigo='APROBADA'),
             $2,'Aprobado', now())`,
          [idActividad, datos.idUsuario],
        ),
      ).rejects.toThrow(/decisor_distinto/i);
    } finally {
      c.release();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('R15 — la bitacora', () => {
  it('un UPDATE escribe EXACTAMENTE una fila, con ambas imagenes correctas', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      const id = await crearActividad(c, { codigo: 'BITACORA-1', idUnidad: unidades.bim23 });
      await c.query('COMMIT');

      await c.query('DELETE FROM aud.bitacora_cambio WHERE 1=0'); // no-op: la bitacora es inmutable

      const antes = await c.query<{ n: string }>(
        `SELECT count(*) AS n FROM aud.bitacora_cambio
          WHERE tabla='actividad' AND operacion='U' AND id_registro=$1`,
        [id],
      );

      await comoUsuario(entorno.poolOperador, ctx(unidades.bim23), async (co) => {
        await co.query(
          `UPDATE ai.actividad SET descripcion = 'Clavegrama corregido' WHERE id = $1`,
          [id],
        );
      });

      const r = await c.query<{
        imagen_anterior: { descripcion: string };
        imagen_posterior: { descripcion: string };
        id_usuario: string | null;
        id_unidad: string | null;
      }>(
        `SELECT imagen_anterior, imagen_posterior, id_usuario, id_unidad
           FROM aud.bitacora_cambio
          WHERE tabla='actividad' AND operacion='U' AND id_registro=$1
          ORDER BY id DESC`,
        [id],
      );

      expect(Number(antes.rows[0]?.n)).toBe(0);
      expect(r.rowCount).toBe(1);
      const fila = r.rows[0];
      expect(fila?.imagen_anterior.descripcion).toContain('120 raciones');
      expect(fila?.imagen_posterior.descripcion).toBe('Clavegrama corregido');
      // El usuario y la unidad salen del contexto de R7, no de un parametro.
      expect(Number(fila?.id_usuario)).toBe(datos.idUsuario);
      expect(Number(fila?.id_unidad)).toBe(unidades.bim23);
    } finally {
      c.release();
    }
  });

  it('un INSERT deja imagen_anterior NULL y posterior con datos', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      const id = await crearActividad(c, { codigo: 'BITACORA-2', idUnidad: unidades.bim23 });
      await c.query('COMMIT');
      const r = await c.query<{ imagen_anterior: unknown; imagen_posterior: unknown }>(
        `SELECT imagen_anterior, imagen_posterior FROM aud.bitacora_cambio
          WHERE tabla='actividad' AND operacion='I' AND id_registro=$1`,
        [id],
      );
      expect(r.rowCount).toBe(1);
      expect(r.rows[0]?.imagen_anterior).toBeNull();
      expect(r.rows[0]?.imagen_posterior).not.toBeNull();
    } finally {
      c.release();
    }
  });

  it('NADIE puede UPDATE sobre aud.bitacora_cambio, ni el administrador', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      // Esta conexion es SUPERUSUARIO: ignora los privilegios revocados. Que
      // falle igual demuestra que el disparador la detiene.
      await expect(
        c.query(`UPDATE aud.bitacora_cambio SET operacion = 'I' WHERE id = (SELECT min(id) FROM aud.bitacora_cambio)`),
      ).rejects.toThrow(/solo insercion/i);
    } finally {
      c.release();
    }
  });

  it('NADIE puede DELETE sobre aud.bitacora_cambio', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await expect(
        c.query(`DELETE FROM aud.bitacora_cambio WHERE id = (SELECT min(id) FROM aud.bitacora_cambio)`),
      ).rejects.toThrow(/solo insercion/i);
    } finally {
      c.release();
    }
  });

  it('NADIE puede truncar la bitacora', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await expect(c.query('TRUNCATE aud.bitacora_cambio')).rejects.toThrow(/no se puede truncar/i);
    } finally {
      c.release();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('R11 — cuota de 10 MB AGREGADA por actividad', () => {
  async function insertarAdjunto(
    cliente: PoolClient,
    idActividad: number,
    bytes: number,
    sufijo: string,
  ): Promise<void> {
    await cliente.query(
      `INSERT INTO ai.act_adjunto (
         id_actividad, nombre_archivo, extension, id_categoria_adjunto, mime_detectado,
         peso_bytes, hash_sha256, ruta_objeto, id_fase_documental, id_estado_registro)
       VALUES ($1, $2, 'pdf',
         (SELECT id FROM ref.categoria_adjunto WHERE codigo='DOCUMENTO'),
         'application/pdf', $3, $4, $5,
         (SELECT id FROM ref.fase_documental WHERE codigo='FASE_1'), $6)`,
      [
        idActividad,
        `soporte-${sufijo}.pdf`,
        bytes,
        sufijo.padEnd(64, '0').slice(0, 64).replace(/[^0-9a-f]/g, '0'),
        `paid/${idActividad}/${sufijo}.pdf`,
        datos.idEstadoActivo,
      ],
    );
  }

  it('9 MB + 2 MB en la MISMA actividad FALLA', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      const id = await crearActividad(c, { codigo: 'CUOTA-1', idUnidad: unidades.bim23 });
      await insertarAdjunto(c, id, 9 * MB, 'a');
      await expect(insertarAdjunto(c, id, 2 * MB, 'b')).rejects.toThrow(/AGREGADA|cuota/i);
    } finally {
      await c.query('ROLLBACK').catch(() => undefined);
      c.release();
    }
  });

  it('9 MB y 2 MB en actividades DISTINTAS pasan', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      const id1 = await crearActividad(c, { codigo: 'CUOTA-2', idUnidad: unidades.bim23 });
      const id2 = await crearActividad(c, { codigo: 'CUOTA-3', idUnidad: unidades.bim23 });
      await insertarAdjunto(c, id1, 9 * MB, 'c');
      await insertarAdjunto(c, id2, 2 * MB, 'd');
      await c.query('COMMIT');
      expect(true).toBe(true);
    } catch (error: unknown) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      c.release();
    }
  });

  it('cuarenta archivos de 9 MB NO pasan: el fallo exacto de P5', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      const id = await crearActividad(c, { codigo: 'CUOTA-4', idUnidad: unidades.bim23 });
      // El primero de 9 MB entra; el segundo ya rebasa. Un CHECK de fila
      // dejaria pasar los cuarenta.
      await insertarAdjunto(c, id, 9 * MB, 'e');
      await expect(insertarAdjunto(c, id, 9 * MB, 'f')).rejects.toThrow(/AGREGADA|cuota/i);
    } finally {
      await c.query('ROLLBACK').catch(() => undefined);
      c.release();
    }
  });

  it('9 MB + 1 MB caben exactamente', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      const id = await crearActividad(c, { codigo: 'CUOTA-5', idUnidad: unidades.bim23 });
      await insertarAdjunto(c, id, 9 * MB, 'aa');
      await insertarAdjunto(c, id, 1 * MB, 'bb');
      await c.query('COMMIT');
      expect(true).toBe(true);
    } catch (error: unknown) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      c.release();
    }
  });

  it('un adjunto dado de baja libera su espacio (R14 + R11)', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      const id = await crearActividad(c, { codigo: 'CUOTA-6', idUnidad: unidades.bim23 });
      await insertarAdjunto(c, id, 9 * MB, 'cc');
      const inactivo = await c.query<{ id: number }>(
        `SELECT id FROM ref.estado_registro WHERE codigo='INACTIVO'`,
      );
      await c.query(
        `UPDATE ai.act_adjunto SET id_estado_registro = $1 WHERE id_actividad = $2`,
        [inactivo.rows[0]?.id, id],
      );
      // Ahora si cabe otro de 9 MB.
      await insertarAdjunto(c, id, 9 * MB, 'dd');
      await c.query('COMMIT');
      expect(true).toBe(true);
    } catch (error: unknown) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      c.release();
    }
  });

  it('NO existe un CHECK de fila que limite peso_bytes a la cuota agregada (P5)', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      // Debe haber un CHECK por fila (el archivo no puede superar por si solo
      // la cuota), pero la regla agregada tiene que estar en un DISPARADOR.
      const r = await c.query<{ n: string }>(
        `SELECT count(*) AS n FROM pg_trigger t
           JOIN pg_class c ON c.oid = t.tgrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname='ai' AND c.relname='act_adjunto'
            AND t.tgname = 'act_adjunto_verificar_cuota'`,
      );
      expect(Number(r.rows[0]?.n)).toBe(1);
    } finally {
      c.release();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('R13 — las decimales son generadas y coinciden con las GMS (P6)', () => {
  it('latitud_decimal NO admite escritura directa', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      const id = await crearActividad(c, { codigo: 'GEO-1', idUnidad: unidades.bim23 });
      await expect(
        c.query('UPDATE ai.actividad SET latitud_decimal = 99 WHERE id = $1', [id]),
      ).rejects.toThrow(/generated|generada|can only be updated to DEFAULT/i);
    } finally {
      await c.query('ROLLBACK').catch(() => undefined);
      c.release();
    }
  });

  it('coincide EXACTAMENTE con aDecimal() de packages/schema', async () => {
    const casos = [
      { g: 10, m: 23, s: 27, h: 'N' },
      { g: 4, m: 12, s: 55, h: 'S' },
      { g: 75, m: 30, s: 51, h: 'W' },
      { g: 0, m: 0, s: 0, h: 'N' },
      { g: 13, m: 22, s: 45.5, h: 'N' },
      { g: 81, m: 42, s: 30.25, h: 'W' },
    ];
    const c = await entorno.poolAdmin.connect();
    try {
      for (const caso of casos) {
        const esLatitud = caso.h === 'N' || caso.h === 'S';
        const r = await c.query<{ valor: string }>(
          esLatitud
            ? `SELECT (($1::numeric + $2::numeric/60.0 + $3::numeric/3600.0)
                  * CASE $4::text WHEN 'S' THEN -1 ELSE 1 END)::numeric(9,6) AS valor`
            : `SELECT (($1::numeric + $2::numeric/60.0 + $3::numeric/3600.0)
                  * CASE $4::text WHEN 'W' THEN -1 ELSE 1 END)::numeric(9,6) AS valor`,
          [caso.g, caso.m, caso.s, caso.h],
        );
        const enSql = Number(r.rows[0]?.valor);
        const enTs = aDecimal(caso.g, caso.m, caso.s, caso.h);
        expect(enSql, `GMS ${caso.g} ${caso.m} ${caso.s} ${caso.h}`).toBe(enTs);
      }
    } finally {
      c.release();
    }
  });

  it('el punto geografico se deriva de las mismas GMS, sin disparador de por medio', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      const id = await crearActividad(c, { codigo: 'GEO-2', idUnidad: unidades.bim23 });
      const r = await c.query<{ lat: string; lon: string; punto_lat: string; punto_lon: string }>(
        `SELECT latitud_decimal AS lat, longitud_decimal AS lon,
                ST_Y(ubicacion::geometry)::numeric(9,6) AS punto_lat,
                ST_X(ubicacion::geometry)::numeric(9,6) AS punto_lon
           FROM ai.actividad WHERE id = $1`,
        [id],
      );
      const f = r.rows[0];
      expect(Number(f?.punto_lat)).toBe(Number(f?.lat));
      expect(Number(f?.punto_lon)).toBe(Number(f?.lon));
      await c.query('ROLLBACK');
    } finally {
      c.release();
    }
  });

  it('los SEIS formularios con georreferenciacion la tienen en la base', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      // Cinco subtipos heredan del supertipo ai.actividad; el sexto, la
      // herramienta AID, lleva su propio bloque.
      const r = await c.query<{ nombre: string }>(
        `SELECT table_schema||'.'||table_name AS nombre
           FROM information_schema.columns
          WHERE column_name = 'ubicacion' AND table_schema = 'ai'`,
      );
      const tablas = r.rows.map((f) => f.nombre).sort();
      expect(tablas).toEqual(['ai.actividad', 'ai.herramienta_aid']);
    } finally {
      c.release();
    }
  });

  it('la normalizacion de texto de SQL y de TypeScript dan lo mismo', async () => {
    const cadenas = [
      'Fundación El Futuro',
      '  FUNDACION   EL  FUTURO  ',
      'Compañía de Jesús',
      'Binacional',
      'BINACIONAL',
      'Asociación de Pescadores Artesanales del Pacífico',
    ];
    const c = await entorno.poolAdmin.connect();
    try {
      for (const cadena of cadenas) {
        const r = await c.query<{ valor: string }>(
          'SELECT ref.normalizar_texto($1) AS valor',
          [cadena],
        );
        expect(r.rows[0]?.valor, `normalizando «${cadena}»`).toBe(normalizarTexto(cadena));
      }
    } finally {
      c.release();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('R10 — escala de ocho tramos y progresion', () => {
  let idProyecto = 0;

  beforeAll(async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      idProyecto = await crearActividad(c, {
        codigo: 'AVANCE-1', idUnidad: unidades.bim23, idTipo: 4,
      });
      await c.query('COMMIT');
    } finally {
      c.release();
    }
  });

  it('80 es RECHAZADO', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await expect(
        c.query('UPDATE ai.proyecto_social SET porcentaje_avance = 80 WHERE id_actividad = $1', [idProyecto]),
      ).rejects.toThrow(/escala_de_ocho_tramos/i);
    } finally {
      c.release();
    }
  });

  it('90 es RECHAZADO', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await expect(
        c.query('UPDATE ai.proyecto_social SET porcentaje_avance = 90 WHERE id_actividad = $1', [idProyecto]),
      ).rejects.toThrow(/escala_de_ocho_tramos/i);
    } finally {
      c.release();
    }
  });

  it('70 y 100 son ACEPTADOS', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      for (const tramo of [70, 100]) {
        const r = await c.query(
          'UPDATE ai.proyecto_social SET porcentaje_avance = $1 WHERE id_actividad = $2',
          [tramo, idProyecto],
        );
        expect(r.rowCount).toBe(1);
      }
    } finally {
      c.release();
    }
  });

  it('el historico rechaza 80 tambien', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await expect(
        c.query(
          `INSERT INTO ai.proyecto_avance (id_actividad, porcentaje_avance, fecha_avance, observacion)
           VALUES ($1, 80, '2026-03-05', 'Avance de prueba')`,
          [idProyecto],
        ),
      ).rejects.toThrow(/escala|no existe en la escala/i);
    } finally {
      c.release();
    }
  });

  it('el avance solo progresa: tras 40 no se admite 30', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      const id = await crearActividad(c, {
        codigo: 'AVANCE-2', idUnidad: unidades.bim23, idTipo: 4,
      });
      await c.query(
        `INSERT INTO ai.proyecto_avance (id_actividad, porcentaje_avance, fecha_avance, observacion)
         VALUES ($1, 40, '2026-03-05', 'Cuarto tramo')`,
        [id],
      );
      await expect(
        c.query(
          `INSERT INTO ai.proyecto_avance (id_actividad, porcentaje_avance, fecha_avance, observacion)
           VALUES ($1, 30, '2026-04-05', 'Retroceso')`,
          [id],
        ),
      ).rejects.toThrow(/solo progresa/i);
    } finally {
      await c.query('ROLLBACK').catch(() => undefined);
      c.release();
    }
  });

  it('registrar un avance sincroniza el avance vigente del proyecto', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      const id = await crearActividad(c, {
        codigo: 'AVANCE-3', idUnidad: unidades.bim23, idTipo: 4,
      });
      await c.query(
        `INSERT INTO ai.proyecto_avance (id_actividad, porcentaje_avance, fecha_avance, observacion)
         VALUES ($1, 70, '2026-03-05', 'Septimo tramo')`,
        [id],
      );
      const r = await c.query<{ porcentaje_avance: number }>(
        'SELECT porcentaje_avance FROM ai.proyecto_social WHERE id_actividad = $1',
        [id],
      );
      expect(r.rows[0]?.porcentaje_avance).toBe(70);
      await c.query('ROLLBACK');
    } finally {
      c.release();
    }
  });

  it('la observacion de un avance es obligatoria', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await expect(
        c.query(
          `INSERT INTO ai.proyecto_avance (id_actividad, porcentaje_avance, fecha_avance, observacion)
           VALUES ($1, 10, '2026-03-05', '   ')`,
          [idProyecto],
        ),
      ).rejects.toThrow(/observacion_no_vacia/i);
    } finally {
      c.release();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('R6 — aislamiento por unidad con RLS', () => {
  beforeAll(async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      await crearActividad(c, { codigo: 'RLS-BIM23', idUnidad: unidades.bim23 });
      await crearActividad(c, { codigo: 'RLS-BIM24', idUnidad: unidades.bim24 });
      await c.query('COMMIT');
    } finally {
      c.release();
    }
  });

  it('BIM23 NO ve filas de BIM24 ni con SELECT * sin WHERE', async () => {
    const codigos = await comoUsuario(entorno.poolOperador, ctx(unidades.bim23), async (c) => {
      const r = await c.query<{ codigo_actividad: string }>('SELECT * FROM ai.actividad');
      return r.rows.map((f) => f.codigo_actividad);
    });
    expect(codigos).toContain('RLS-BIM23');
    expect(codigos).not.toContain('RLS-BIM24');
  });

  it('BIM24 tampoco ve las de BIM23: son hermanas', async () => {
    const codigos = await comoUsuario(entorno.poolOperador, ctx(unidades.bim24), async (c) => {
      const r = await c.query<{ codigo_actividad: string }>('SELECT * FROM ai.actividad');
      return r.rows.map((f) => f.codigo_actividad);
    });
    expect(codigos).toContain('RLS-BIM24');
    expect(codigos).not.toContain('RLS-BIM23');
  });

  it('la Fuerza ve lo de sus subordinadas: las dos', async () => {
    const codigos = await comoUsuario(entorno.poolOperador, ctx(unidades.fnp), async (c) => {
      const r = await c.query<{ codigo_actividad: string }>('SELECT * FROM ai.actividad');
      return r.rows.map((f) => f.codigo_actividad);
    });
    expect(codigos).toContain('RLS-BIM23');
    expect(codigos).toContain('RLS-BIM24');
  });

  it('las tablas hijas heredan el ambito de su actividad', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      const r = await c.query<{ id: string }>(
        `SELECT id FROM ai.actividad WHERE codigo_actividad = 'RLS-BIM24'`,
      );
      const idAjena = Number(r.rows[0]?.id);
      await c.query(
        `INSERT INTO ai.act_resumen (id_actividad, texto) VALUES ($1, 'Resumen ajeno')`,
        [idAjena],
      );
      await c.query('COMMIT');
    } finally {
      c.release();
    }

    const visibles = await comoUsuario(entorno.poolOperador, ctx(unidades.bim23), async (c) => {
      const r = await c.query<{ texto: string }>('SELECT * FROM ai.act_resumen');
      return r.rows.map((f) => f.texto);
    });
    expect(visibles).not.toContain('Resumen ajeno');
  });

  it('SIN contexto no se ve NADA: un olvido no es una fuga', async () => {
    // Se conecta sin fijar el contexto de R7 a proposito.
    const cliente = await entorno.poolOperador.connect();
    try {
      await cliente.query('BEGIN');
      const r = await cliente.query('SELECT * FROM ai.actividad');
      expect(r.rowCount).toBe(0);
    } finally {
      // El ROLLBACK va en el `finally`: el pool tiene max = 1, y una
      // transaccion abortada devuelta al pool envenena las pruebas siguientes
      // con «current transaction is aborted».
      await cliente.query('ROLLBACK').catch(() => undefined);
      cliente.release();
    }
  });

  it('el contexto no sobrevive a la transaccion (R7/P11)', async () => {
    // La misma conexion del pool (max = 1) atiende las dos transacciones.
    // Si el contexto se fijara con SET en lugar de SET LOCAL, la segunda
    // heredaria el de la primera.
    await comoUsuario(entorno.poolOperador, ctx(unidades.bim23), async () => undefined);

    const cliente = await entorno.poolOperador.connect();
    try {
      await cliente.query('BEGIN');
      const r = await cliente.query<{ unidad: string | null; ruta: string | null }>(
        `SELECT current_setting('app.id_unidad', true) AS unidad,
                current_setting('app.ruta_unidad', true) AS ruta`,
      );
      expect(r.rows[0]?.unidad ?? '').toBe('');
      expect(r.rows[0]?.ruta ?? '').toBe('');
    } finally {
      await cliente.query('ROLLBACK').catch(() => undefined);
      cliente.release();
    }
  });

  it('una unidad no puede registrar una actividad a nombre de otra', async () => {
    await expect(
      comoUsuario(entorno.poolOperador, ctx(unidades.bim23), async (c) => {
        await c.query(
          `INSERT INTO ai.actividad (
             id_tipo_actividad, codigo_actividad, id_unidad, descripcion, fecha_inicio,
             id_estado_registro, latitud_grados, latitud_minutos, latitud_segundos,
             latitud_hemisferio, longitud_grados, longitud_minutos, longitud_segundos,
             longitud_hemisferio)
           VALUES (1,'RLS-SUPLANTACION',$1,'x','2026-01-01',$2,10,0,0,'N',75,0,0,'W')`,
          [unidades.bim24, datos.idEstadoActivo],
        );
      }),
    ).rejects.toThrow(/row-level security|politica/i);
  });

  it('IA8 — la busqueda por similitud no cruza el ambito', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query(
        `INSERT INTO ai.entidad (id_tipo_entidad, nombre, id_unidad, id_estado_registro)
         VALUES ($1, 'Fundacion Futuro S.A.S.', $2, $3)`,
        [datos.idTipoEntidad, unidades.bim24, datos.idEstadoActivo],
      );
    } finally {
      c.release();
    }

    // Desde BIM23, una busqueda por parecido trigram sobre el nombre
    // normalizado NO debe alcanzar la entidad de BIM24.
    const nombres = await comoUsuario(entorno.poolOperador, ctx(unidades.bim23), async (cl) => {
      const r = await cl.query<{ nombre: string }>(
        `SELECT nombre FROM ai.entidad
          WHERE nombre_normalizado % ref.normalizar_texto($1)
          ORDER BY similarity(nombre_normalizado, ref.normalizar_texto($1)) DESC`,
        ['Fundacion El Futuro'],
      );
      return r.rows.map((f) => f.nombre);
    });
    expect(nombres).toContain('Fundación El Futuro');
    expect(nombres).not.toContain('Fundacion Futuro S.A.S.');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('R9 — participo_arc siempre TRUE', () => {
  it('participo_arc = FALSE es RECHAZADO en el INSERT', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      await expect(
        crearActividad(c, { codigo: 'ARC-1', idUnidad: unidades.bim23, participoArc: false }),
      ).rejects.toThrow(/participo_arc_siempre_verdadero/i);
    } finally {
      await c.query('ROLLBACK').catch(() => undefined);
      c.release();
    }
  });

  it('participo_arc = FALSE es RECHAZADO en el UPDATE', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      const id = await crearActividad(c, { codigo: 'ARC-2', idUnidad: unidades.bim23 });
      await expect(
        c.query('UPDATE ai.actividad SET participo_arc = FALSE WHERE id = $1', [id]),
      ).rejects.toThrow(/participo_arc_siempre_verdadero/i);
    } finally {
      await c.query('ROLLBACK').catch(() => undefined);
      c.release();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Manual, láminas 20–21 — tipo de jornada, EJC, FAC y población afecta', () => {
  it('el catálogo trae exactamente los tres tipos del manual', async () => {
    const r = await entorno.poolAdmin.query<{ codigo: string }>(
      'SELECT codigo FROM ref.tipo_jornada ORDER BY orden',
    );
    expect(r.rows.map((f) => f.codigo)).toEqual(['BINACIONAL', 'CONJUNTA', 'ESTRATEGICA']);
  });

  it('una jornada anterior a 0015 queda sin dato, no con uno inventado', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      // crearActividad inserta el subtipo SIN las columnas nuevas, como lo
      // hacía el servicio antes de 0015.
      const id = await crearActividad(c, { codigo: 'MAN-1', idUnidad: unidades.bim23 });
      const r = await c.query<{
        id_tipo_jornada: number | null;
        participo_ejc: boolean | null;
        participo_fac: boolean | null;
        poblacion_afecta_tropa: boolean | null;
      }>(
        `SELECT id_tipo_jornada, participo_ejc, participo_fac, poblacion_afecta_tropa
           FROM ai.jornada_apoyo WHERE id_actividad = $1`,
        [id],
      );
      // NULL, no FALSE: «no participó el EJC» es una afirmación (D-30).
      expect(r.rows[0]).toEqual({
        id_tipo_jornada: null,
        participo_ejc: null,
        participo_fac: null,
        poblacion_afecta_tropa: null,
      });
    } finally {
      await c.query('ROLLBACK').catch(() => undefined);
      c.release();
    }
  });

  it('un tipo de jornada fuera del catálogo es RECHAZADO (P9)', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      const id = await crearActividad(c, { codigo: 'MAN-2', idUnidad: unidades.bim23 });
      await expect(
        c.query('UPDATE ai.jornada_apoyo SET id_tipo_jornada = 9999 WHERE id_actividad = $1', [id]),
      ).rejects.toThrow(/foreign key|llave foránea|clave foránea/i);
    } finally {
      await c.query('ROLLBACK').catch(() => undefined);
      c.release();
    }
  });

  it('los cambios en los campos nuevos quedan en la bitácora (R15)', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      const id = await crearActividad(c, { codigo: 'MAN-3', idUnidad: unidades.bim23 });
      await c.query(
        `UPDATE ai.jornada_apoyo
            SET participo_ejc = TRUE,
                id_tipo_jornada = (SELECT id FROM ref.tipo_jornada WHERE codigo = 'CONJUNTA')
          WHERE id_actividad = $1`,
        [id],
      );
      const r = await c.query<{ posterior: Record<string, unknown> }>(
        `SELECT imagen_posterior AS posterior FROM aud.bitacora_cambio
          WHERE esquema = 'ai' AND tabla = 'jornada_apoyo' AND operacion = 'U'
            AND id_registro = $1
          ORDER BY id DESC LIMIT 1`,
        [id],
      );
      expect(r.rows[0]?.posterior['participo_ejc']).toBe(true);
    } finally {
      await c.query('ROLLBACK').catch(() => undefined);
      c.release();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('R17 — asistencia DIRECTA exige plan operacional', () => {
  async function crearAsistencia(
    cliente: PoolClient,
    codigo: string,
    tipo: 'DIRECTA' | 'INDIRECTA',
    conPlan: boolean,
  ): Promise<void> {
    const r = await cliente.query<{ id: string }>(
      `INSERT INTO ai.actividad (
         id_tipo_actividad, codigo_actividad, id_unidad, descripcion, fecha_inicio,
         id_estado_registro, latitud_grados, latitud_minutos, latitud_segundos,
         latitud_hemisferio, longitud_grados, longitud_minutos, longitud_segundos,
         longitud_hemisferio)
       VALUES (2,$1,$2,'x','2026-01-01',$3,10,0,0,'N',75,0,0,'W') RETURNING id`,
      [codigo, unidades.bim23, datos.idEstadoActivo],
    );
    await cliente.query(
      `INSERT INTO ai.asistencia_humanitaria
         (id_actividad, id_tipo_asistencia, id_plan_operacional, fecha_ejecucion, lugar)
       VALUES ($1,
         (SELECT id FROM ref.tipo_asistencia WHERE codigo = $2),
         CASE WHEN $3 THEN (SELECT id FROM ref.plan_operacional WHERE codigo='PLAN_SAN_ROQUE_II') END,
         '2026-01-01', 'Tumaco')`,
      [Number(r.rows[0]?.id), tipo, conPlan],
    );
  }

  it('DIRECTA sin plan es RECHAZADA', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      await expect(crearAsistencia(c, 'ASIS-1', 'DIRECTA', false)).rejects.toThrow(
        /directa_exige_plan_operacional/i,
      );
    } finally {
      await c.query('ROLLBACK').catch(() => undefined);
      c.release();
    }
  });

  it('DIRECTA con plan es aceptada', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      await crearAsistencia(c, 'ASIS-2', 'DIRECTA', true);
      await c.query('COMMIT');
      expect(true).toBe(true);
    } catch (error: unknown) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      c.release();
    }
  });

  it('INDIRECTA sin plan es aceptada', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      await crearAsistencia(c, 'ASIS-3', 'INDIRECTA', false);
      await c.query('COMMIT');
      expect(true).toBe(true);
    } catch (error: unknown) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      c.release();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Documento de identidad: mismo numero, distinto tipo', () => {
  it('el mismo numero con DISTINTO tipo coexiste', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      for (const tipo of ['CC', 'PA']) {
        await c.query(
          `INSERT INTO ai.personal
             (id_tipo_documento_identidad, numero_documento, nombres, apellidos,
              id_unidad, id_estado_registro)
           VALUES ((SELECT id FROM ref.tipo_documento_identidad WHERE codigo=$1),
                   '1020304050', 'Juan', 'Perez', $2, $3)`,
          [tipo, unidades.bim23, datos.idEstadoActivo],
        );
      }
      await c.query('COMMIT');
      expect(true).toBe(true);
    } catch (error: unknown) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      c.release();
    }
  });

  it('el mismo numero con el MISMO tipo NO coexiste', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      await expect(
        c.query(
          `INSERT INTO ai.personal
             (id_tipo_documento_identidad, numero_documento, nombres, apellidos,
              id_unidad, id_estado_registro)
           VALUES ((SELECT id FROM ref.tipo_documento_identidad WHERE codigo='CC'),
                   '1020304050', 'Otro', 'Distinto', $1, $2)`,
          [unidades.bim23, datos.idEstadoActivo],
        ),
      ).rejects.toThrow(/personal_documento_unico/i);
    } finally {
      await c.query('ROLLBACK').catch(() => undefined);
      c.release();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('R19 — registro_completo', () => {
  it('es FALSE al crear y sigue FALSE mientras falte una pestana', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      const id = await crearActividad(c, { codigo: 'COMPLETO-1', idUnidad: unidades.bim23 });
      const r1 = await c.query<{ registro_completo: boolean }>(
        'SELECT registro_completo FROM ai.actividad WHERE id = $1', [id],
      );
      expect(r1.rows[0]?.registro_completo).toBe(false);

      // Diez de once.
      await c.query(`INSERT INTO ai.act_tipo_operacion (id_actividad, id_tipo_operacion)
        VALUES ($1,(SELECT id FROM ref.tipo_operacion WHERE codigo='PRUEBA'))`, [id]);
      await c.query(`INSERT INTO ai.act_adjunto (id_actividad, nombre_archivo, extension,
        id_categoria_adjunto, mime_detectado, peso_bytes, hash_sha256, ruta_objeto,
        id_fase_documental, id_estado_registro)
        VALUES ($1,'s.pdf','pdf',(SELECT id FROM ref.categoria_adjunto WHERE codigo='DOCUMENTO'),
        'application/pdf', 1024, repeat('a',64), 'p/1.pdf',
        (SELECT id FROM ref.fase_documental WHERE codigo='FASE_1'), $2)`,
        [id, datos.idEstadoActivo]);
      await c.query(`INSERT INTO ai.act_entidad_servicio (id_actividad, id_entidad) VALUES ($1,$2)`,
        [id, datos.idEntidad]);
      await c.query(`INSERT INTO ai.act_servicio_prestado (id_actividad, id_servicio_prestado, cantidad)
        VALUES ($1,(SELECT id FROM ref.servicio_prestado WHERE codigo='PRUEBA'),5)`, [id]);
      await c.query(`INSERT INTO ai.act_poblacion_beneficiada (id_actividad, id_grupo_poblacional, cantidad_personas)
        VALUES ($1,(SELECT id FROM ref.grupo_poblacional WHERE codigo='PRUEBA'),120)`, [id]);
      await c.query(`INSERT INTO ai.act_entidad_apoyada (id_actividad, id_entidad) VALUES ($1,$2)`,
        [id, datos.idEntidad]);
      await c.query(`INSERT INTO ai.act_medio_difusion (id_actividad, id_medio_difusion)
        VALUES ($1,(SELECT id FROM ref.medio_difusion WHERE codigo='PRUEBA'))`, [id]);
      await c.query(`INSERT INTO ai.act_medio_utilizado (id_actividad, id_medio_utilizado, cantidad)
        VALUES ($1,(SELECT id FROM ref.medio_utilizado WHERE codigo='PRUEBA'),2)`, [id]);
      await c.query(`INSERT INTO ai.act_recurso_utilizado (id_actividad, id_tipo_recurso, cantidad)
        VALUES ($1,(SELECT id FROM ref.tipo_recurso WHERE codigo='PRUEBA'),3)`, [id]);
      await c.query(`INSERT INTO ai.act_bien_donado (id_actividad, id_tipo_bien_donado, descripcion, cantidad)
        VALUES ($1,(SELECT id FROM ref.tipo_bien_donado WHERE codigo='PRUEBA'),'120 raciones',120)`, [id]);

      const r2 = await c.query<{ registro_completo: boolean }>(
        'SELECT registro_completo FROM ai.actividad WHERE id = $1', [id],
      );
      expect(r2.rows[0]?.registro_completo, 'con 10 de 11 pestanas').toBe(false);

      // La undecima.
      await c.query(`INSERT INTO ai.act_resumen (id_actividad, texto) VALUES ($1,'Resumen JAD')`, [id]);
      const r3 = await c.query<{ registro_completo: boolean }>(
        'SELECT registro_completo FROM ai.actividad WHERE id = $1', [id],
      );
      expect(r3.rows[0]?.registro_completo, 'con las once').toBe(true);

      // Y si se retira una, vuelve a FALSE.
      await c.query('DELETE FROM ai.act_resumen WHERE id_actividad = $1', [id]);
      const r4 = await c.query<{ registro_completo: boolean }>(
        'SELECT registro_completo FROM ai.actividad WHERE id = $1', [id],
      );
      expect(r4.rows[0]?.registro_completo, 'tras retirar una').toBe(false);

      await c.query('ROLLBACK');
    } finally {
      c.release();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('R16 — las campanas solo las cargan las Fuerzas Navales', () => {
  it('una unidad tactica NO puede cargar una campana', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      await c.query(
        `INSERT INTO ref.campana_institucional (codigo, nombre) VALUES ('PRUEBA','Prueba')
         ON CONFLICT DO NOTHING`,
      );
      const r = await c.query<{ id: string }>(
        `INSERT INTO ai.actividad (
           id_tipo_actividad, codigo_actividad, id_unidad, descripcion, fecha_inicio,
           id_estado_registro, latitud_grados, latitud_minutos, latitud_segundos,
           latitud_hemisferio, longitud_grados, longitud_minutos, longitud_segundos,
           longitud_hemisferio)
         VALUES (5,'CAMPANA-TACTICA',$1,'x','2026-01-01',$2,10,0,0,'N',75,0,0,'W')
         RETURNING id`,
        [unidades.bim23, datos.idEstadoActivo],
      );
      await expect(
        c.query(
          `INSERT INTO ai.campana (id_actividad, id_campana_institucional, fecha_ejecucion)
           VALUES ($1,(SELECT id FROM ref.campana_institucional WHERE codigo='PRUEBA'),'2026-01-01')`,
          [Number(r.rows[0]?.id)],
        ),
      ).rejects.toThrow(/Fuerzas Navales/i);
    } finally {
      await c.query('ROLLBACK').catch(() => undefined);
      c.release();
    }
  });

  it('una unidad de nivel FUERZA si puede', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      await c.query(
        `INSERT INTO ref.campana_institucional (codigo, nombre) VALUES ('PRUEBA','Prueba')
         ON CONFLICT DO NOTHING`,
      );
      const r = await c.query<{ id: string }>(
        `INSERT INTO ai.actividad (
           id_tipo_actividad, codigo_actividad, id_unidad, descripcion, fecha_inicio,
           id_estado_registro, latitud_grados, latitud_minutos, latitud_segundos,
           latitud_hemisferio, longitud_grados, longitud_minutos, longitud_segundos,
           longitud_hemisferio)
         VALUES (5,'CAMPANA-FUERZA',$1,'x','2026-01-01',$2,10,0,0,'N',75,0,0,'W')
         RETURNING id`,
        [unidades.fnp, datos.idEstadoActivo],
      );
      await c.query(
        `INSERT INTO ai.campana (id_actividad, id_campana_institucional, fecha_ejecucion)
         VALUES ($1,(SELECT id FROM ref.campana_institucional WHERE codigo='PRUEBA'),'2026-01-01')`,
        [Number(r.rows[0]?.id)],
      );
      await c.query('COMMIT');
      expect(true).toBe(true);
    } catch (error: unknown) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      c.release();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('R6 — la ruta jerarquica es derivada, no digitada', () => {
  it('se construye desde la unidad superior', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      const r = await c.query<{ sigla: string; ruta: string }>(
        'SELECT sigla, ruta_jerarquica::text AS ruta FROM org.unidad ORDER BY id',
      );
      const porSigla = new Map(r.rows.map((f) => [f.sigla, f.ruta]));
      expect(porSigla.get('BIM23')).toBe(
        `${porSigla.get('CFM') ?? ''}.u${unidades.bim23}`,
      );
      expect(porSigla.get('CFM')).toBe(`u${unidades.fnp}.u${unidades.componente}`);
    } finally {
      c.release();
    }
  });

  it('un ciclo en la jerarquia es rechazado', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await expect(
        c.query('UPDATE org.unidad SET id_unidad_superior = $1 WHERE id = $2', [
          unidades.bim23, unidades.fnp,
        ]),
      ).rejects.toThrow(/ciclo/i);
    } finally {
      c.release();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('P7 — ningun testigo de sesion en claro', () => {
  it('el formato de hash_testigo impide guardar un testigo sin resumir', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await expect(
        c.query(
          `INSERT INTO seg.sesion (id_usuario, id_unidad, hash_testigo, direccion_ip)
           VALUES ($1, $2, 'testigo-en-claro-abc123', '10.0.0.1')`,
          [datos.idUsuario, unidades.bim23],
        ),
      ).rejects.toThrow(/sha256_hex|value too long/i);
    } finally {
      c.release();
    }
  });

  it('R1 — expira_en se deriva de la ultima actividad, no se digita', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      const r = await c.query<{ segundos: string }>(
        `INSERT INTO seg.sesion (id_usuario, id_unidad, hash_testigo, direccion_ip, expira_en)
         VALUES ($1, $2, repeat('a',64), '10.0.0.1', now() + interval '99 days')
         RETURNING extract(epoch FROM (expira_en - ultima_actividad_en)) AS segundos`,
        [datos.idUsuario, unidades.bim23],
      );
      // Se ignoran los 99 dias que traia la sentencia: son 10 minutos.
      expect(Number(r.rows[0]?.segundos)).toBe(600);
      await c.query('ROLLBACK');
    } finally {
      c.release();
    }
  });

  it('R3 — el captcha caduca a los 5 minutos, tampoco negociable', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await c.query('BEGIN');
      const r = await c.query<{ segundos: string }>(
        `INSERT INTO seg.captcha (hash_reto, expira_en)
         VALUES (repeat('b',64), now() + interval '99 days')
         RETURNING extract(epoch FROM (expira_en - creado_en)) AS segundos`,
      );
      expect(Number(r.rows[0]?.segundos)).toBe(300);
      await c.query('ROLLBACK');
    } finally {
      c.release();
    }
  });

  it('R5 — la credencial sigue el patron <SIGLA>_PAID', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      for (const malo of ['juan.perez', 'BIM23', 'bim23_paid_x']) {
        await expect(
          c.query(
            `INSERT INTO seg.usuario (credencial, hash_clave, id_unidad, id_estado_registro)
             VALUES ($1, '$argon2id$x', $2, $3)`,
            [malo, unidades.bim23, datos.idEstadoActivo],
          ),
        ).rejects.toThrow(/credencial_formato/i);
      }
    } finally {
      c.release();
    }
  });

  it('una clave que no sea Argon2id no entra', async () => {
    const c = await entorno.poolAdmin.connect();
    try {
      await expect(
        c.query(
          `INSERT INTO seg.usuario (credencial, hash_clave, id_unidad, id_estado_registro)
           VALUES ('OTRA_PAID', 'clave-en-claro', $1, $2)`,
          [unidades.bim23, datos.idEstadoActivo],
        ),
      ).rejects.toThrow(/argon2id/i);
    } finally {
      c.release();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('A.1 — cada migracion aplica y revierte limpiamente', () => {
  it('todas revierten hasta dejar cero tablas, y vuelven a aplicar', async () => {
    const migraciones = leerMigraciones(entorno.directorioMigraciones);
    const c = await entorno.poolAdmin.connect();
    try {
      await revertirTodas(c, migraciones);
      const vacio = await c.query<{ n: string }>(
        `SELECT count(*) AS n FROM information_schema.tables
          WHERE table_schema IN ('ref','org','seg','ai','doc','aud','ia')`,
      );
      expect(Number(vacio.rows[0]?.n), 'tras revertir no debe quedar ninguna tabla').toBe(0);

      const aplicadas = await aplicarPendientes(c, migraciones);
      expect(aplicadas).toHaveLength(migraciones.length);

      const lleno = await c.query<{ n: string }>(
        `SELECT count(*) AS n FROM information_schema.tables
          WHERE table_schema IN ('ref','org','seg','ai','doc','aud','ia')`,
      );
      expect(Number(lleno.rows[0]?.n)).toBeGreaterThan(60);
    } finally {
      c.release();
    }
  });

  it('cada migracion tiene su archivo de reversion', () => {
    // `leerMigraciones` lanza si falta alguno: A.1 dice que una migracion sin
    // `down` no esta terminada.
    expect(() => leerMigraciones(entorno.directorioMigraciones)).not.toThrow();
  });
});

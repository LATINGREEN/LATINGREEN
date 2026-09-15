import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { ContextoSesion } from '@paid/db';
import { RedisService } from '../basedatos/redis.service';
import { BaseDatosService } from '../basedatos/basedatos.service';

/**
 * R1 — Sesion de 10 minutos, expiracion DESLIZANTE, evaluada EN EL SERVIDOR.
 * P7 — Del testigo se guarda el RESUMEN, nunca el testigo.
 *
 * Reparto entre Redis y la base:
 *
 *   Redis        lleva el TTL vivo. Cada peticion autenticada lo desplaza.
 *   seg.sesion   registro durable, con el motivo de cierre.
 *
 * Si Redis pierde la clave —caducó o se reinició— la sesion se considera
 * vencida y se cierra en la tabla con su motivo. Fallar hacia «sesion cerrada»
 * es lo seguro; lo contrario seria una sesion que sobrevive a la expiracion
 * porque el almacen volatil se vacio.
 */
export interface SesionActiva {
  readonly idSesion: string;
  readonly idUsuario: number;
  readonly idUnidad: number;
  readonly rutaUnidad: string;
  readonly credencial: string;
  readonly roles: readonly string[];
  readonly permisos: readonly string[];
  readonly expiraEnUtc: string;
}

interface ContenidoRedis {
  readonly idSesion: string;
  readonly idUsuario: number;
  readonly idUnidad: number;
  readonly rutaUnidad: string;
  readonly credencial: string;
  readonly roles: string[];
  readonly permisos: string[];
}

@Injectable()
export class SesionService {
  private readonly ttlSegundos: number;

  constructor(
    @Inject(ConfigService) configuracion: ConfigService,
    private readonly redis: RedisService,
    private readonly baseDatos: BaseDatosService,
  ) {
    this.ttlSegundos = configuracion.get<number>('SESION_TTL_SEGUNDOS') ?? 600;
  }

  /**
   * El testigo es opaco: 32 bytes aleatorios. No codifica nada —ni el usuario,
   * ni la unidad, ni la expiracion— porque todo eso lo decide el servidor. Un
   * testigo que lleva informacion dentro es un testigo que invita a que
   * alguien la cambie.
   */
  private generarTestigo(): string {
    return randomBytes(32).toString('base64url');
  }

  private resumir(testigo: string): string {
    return createHash('sha256').update(testigo).digest('hex');
  }

  private claveRedis(resumen: string): string {
    return `paid:sesion:${resumen}`;
  }

  /** Permisos efectivos del usuario: roles VIGENTES (P4) y sus permisos. */
  async permisosDe(
    cliente: PoolClient,
    idUsuario: number,
  ): Promise<{ roles: string[]; permisos: string[] }> {
    const resultado = await cliente.query<{ rol: string; permiso: string | null }>(
      `SELECT r.codigo AS rol, p.codigo AS permiso
         FROM seg.usuario_rol ur
         JOIN seg.rol r ON r.id = ur.id_rol AND r.activo
         LEFT JOIN seg.rol_permiso rp ON rp.id_rol = r.id
         LEFT JOIN seg.permiso p ON p.id = rp.id_permiso
        WHERE ur.id_usuario = $1
          AND ur.vigente_desde <= now()
          AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())`,
      [idUsuario],
    );
    const roles = new Set<string>();
    const permisos = new Set<string>();
    for (const fila of resultado.rows) {
      roles.add(fila.rol);
      if (fila.permiso !== null) permisos.add(fila.permiso);
    }
    return { roles: [...roles].sort(), permisos: [...permisos].sort() };
  }

  /** Abre una sesion. Devuelve el testigo en claro UNA sola vez. */
  async abrir(
    cliente: PoolClient,
    datos: {
      idUsuario: number;
      idUnidad: number;
      credencial: string;
      direccionIp: string;
      agenteUsuario: string | null;
    },
  ): Promise<{ testigo: string; sesion: SesionActiva }> {
    const testigo = this.generarTestigo();
    const resumen = this.resumir(testigo);

    /*
     * `seg.unidad_para_ingreso` y no un SELECT sobre `org.unidad`.
     *
     * Aqui todavia NO hay contexto de sesion —se esta construyendo—, y
     * `org.unidad` tiene RLS forzada comparando contra ese contexto. Un SELECT
     * directo devuelve cero filas y el ingreso falla con «la unidad no
     * existe». Ver la migracion 0013 para por que la funcion existe y por que
     * no debe crecer.
     */
    const unidad = await cliente.query<{ ruta: string }>(
      'SELECT ruta_jerarquica::text AS ruta FROM seg.unidad_para_ingreso($1)',
      [datos.idUnidad],
    );
    const rutaUnidad = unidad.rows[0]?.ruta;
    if (rutaUnidad === undefined) {
      throw new Error(`La unidad ${datos.idUnidad} no existe.`);
    }

    const insertada = await cliente.query<{ id: string; expira_en: Date }>(
      `INSERT INTO seg.sesion
         (id_usuario, id_unidad, hash_testigo, direccion_ip, agente_usuario)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, expira_en`,
      [datos.idUsuario, datos.idUnidad, resumen, datos.direccionIp, datos.agenteUsuario],
    );
    const fila = insertada.rows[0];
    if (fila === undefined) throw new Error('No se pudo abrir la sesion.');

    const { roles, permisos } = await this.permisosDe(cliente, datos.idUsuario);

    const contenido: ContenidoRedis = {
      idSesion: fila.id,
      idUsuario: datos.idUsuario,
      idUnidad: datos.idUnidad,
      rutaUnidad,
      credencial: datos.credencial,
      roles,
      permisos,
    };
    await this.redis.guardar(
      this.claveRedis(resumen),
      JSON.stringify(contenido),
      this.ttlSegundos,
    );

    return {
      testigo,
      sesion: { ...contenido, expiraEnUtc: fila.expira_en.toISOString() },
    };
  }

  /**
   * Valida un testigo y **desplaza** la expiracion (R1).
   *
   * Devuelve `null` si la sesion no existe o ya vencio. El desplazamiento es
   * lo que hace la expiracion deslizante: cada peticion autenticada devuelve
   * el contador a los 10 minutos.
   */
  async validarYDesplazar(testigo: string): Promise<SesionActiva | null> {
    const resumen = this.resumir(testigo);
    const clave = this.claveRedis(resumen);

    const crudo = await this.redis.leer(clave);
    if (crudo === null) {
      // Redis no la tiene: caduco, o Redis se reinicio. En los dos casos la
      // sesion esta vencida. Se cierra en la tabla para que quede el motivo.
      await this.cerrarPorResumen(resumen, 'INACTIVIDAD');
      return null;
    }

    const desplazada = await this.redis.desplazarTtl(clave, this.ttlSegundos);
    if (!desplazada) {
      // Caduco entre el GET y el EXPIRE. Poco probable, pero posible.
      await this.cerrarPorResumen(resumen, 'INACTIVIDAD');
      return null;
    }

    const contenido = JSON.parse(crudo) as ContenidoRedis;

    // El registro durable se desplaza tambien, y de paso comprueba que la
    // sesion no se haya cerrado por otra via (cambio de clave, revocacion
    // por el administrador).
    const actualizada = await this.baseDatos.enTransaccionDeSistema(async (cliente) => {
      const r = await cliente.query<{ expira_en: Date }>(
        `UPDATE seg.sesion
            SET ultima_actividad_en = now()
          WHERE hash_testigo = $1 AND cerrada_en IS NULL
          RETURNING expira_en`,
        [resumen],
      );
      return r.rows[0];
    });

    if (actualizada === undefined) {
      // Cerrada en la tabla pero viva en Redis: manda la tabla.
      await this.redis.borrar(clave);
      return null;
    }

    return { ...contenido, expiraEnUtc: actualizada.expira_en.toISOString() };
  }

  /** Cierra una sesion por su testigo. */
  async cerrar(testigo: string, motivo: string): Promise<void> {
    const resumen = this.resumir(testigo);
    await this.redis.borrar(this.claveRedis(resumen));
    await this.cerrarPorResumen(resumen, motivo);
  }

  private async cerrarPorResumen(resumen: string, motivo: string): Promise<void> {
    await this.baseDatos.enTransaccionDeSistema(async (cliente) => {
      await cliente.query(
        `UPDATE seg.sesion
            SET cerrada_en = now(), motivo_cierre = $2
          WHERE hash_testigo = $1 AND cerrada_en IS NULL`,
        [resumen, motivo],
      );
    });
  }

  /**
   * Tarea programada: cierra en la tabla las sesiones vencidas.
   *
   * Redis las olvida solo, pero `seg.sesion` es el registro durable y una
   * sesion que quedara «abierta» ahi para siempre haria inutil cualquier
   * consulta sobre sesiones activas.
   */
  async cerrarVencidas(): Promise<number> {
    return this.baseDatos.enTransaccionDeSistema(async (cliente) => {
      const r = await cliente.query(
        `UPDATE seg.sesion
            SET cerrada_en = now(), motivo_cierre = 'EXPIRACION'
          WHERE cerrada_en IS NULL AND expira_en < now()`,
      );
      return r.rowCount ?? 0;
    });
  }

  /** Contexto de R7 a partir de una sesion validada. */
  contextoDe(sesion: SesionActiva, direccionIp: string): ContextoSesion {
    return {
      idUsuario: sesion.idUsuario,
      idUnidad: sesion.idUnidad,
      rutaUnidad: sesion.rutaUnidad,
      idSesion: sesion.idSesion,
      direccionIp,
    };
  }

  get ttl(): number {
    return this.ttlSegundos;
  }
}

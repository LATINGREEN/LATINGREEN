import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { CODIGOS_ERROR, crearHerramienta } from '@paid/schema';
import type { CrearHerramienta, HerramientaEnListado } from '@paid/schema';
import { BaseDatosService } from '../basedatos/basedatos.service';
import { RequierePermiso } from '../seguridad/requiere-permiso.decorator';
import { esViolacionUnicidad } from './personal.controller';

/**
 * Maestro 3 de 3 (R8) — Herramientas AID.
 *
 * ⚠️ R13 — Este es el formulario con georreferenciacion que se olvida, porque
 * no es una actividad. Son SEIS los que la capturan, y este es el sexto. Por
 * eso el `POST` recibe los ocho componentes GMS igual que una jornada: las
 * decimales y el `geography(Point,4326)` son columnas GENERADAS, no se
 * escriben (P6).
 */

interface FilaHerramienta {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly tipo: string;
  readonly municipio: string | null;
  readonly fecha_registro: string;
  readonly unidad: string;
  readonly latitud_decimal: string;
  readonly longitud_decimal: string;
  readonly estado: string | null;
  readonly fecha_potenciacion: string | null;
  readonly responsable_nombre: string | null;
  readonly responsable_documento: string | null;
  readonly responsable_correo: string | null;
  readonly responsable_telefono: string | null;
}

/** Un error de un campo, con la forma de `detalles` que ya usa el formulario. */
function errorDeCampo(codigo: string, mensaje: string, campo: string, detalle: string): BadRequestException {
  return new BadRequestException({ codigo, mensaje, detalles: [{ campo, mensaje: detalle }] });
}

@Controller('herramientas')
export class HerramientasController {
  constructor(private readonly baseDatos: BaseDatosService) {}

  @RequierePermiso('HERRAMIENTA.CONSULTAR')
  @Get()
  async listar(@Query('texto') texto?: string): Promise<{
    readonly filas: readonly HerramientaEnListado[];
    readonly total: number;
  }> {
    const buscar = (texto ?? '').trim();
    const resultado = await this.baseDatos.cliente.query<FilaHerramienta>(
      `SELECT h.id, h.codigo, h.nombre, t.nombre AS tipo,
              m.nombre AS municipio,
              to_char(h.fecha_registro, 'YYYY-MM-DD') AS fecha_registro,
              u.sigla AS unidad,
              h.latitud_decimal, h.longitud_decimal,
              e.nombre AS estado,
              to_char(h.fecha_potenciacion, 'YYYY-MM-DD') AS fecha_potenciacion,
              CASE WHEN p.id IS NULL THEN NULL
                   ELSE concat_ws(' ', g.nombre, p.nombres, p.apellidos) END AS responsable_nombre,
              CASE WHEN p.id IS NULL THEN NULL
                   ELSE concat_ws(' ', d.codigo, p.numero_documento) END AS responsable_documento,
              p.correo AS responsable_correo,
              p.telefono AS responsable_telefono
         FROM ai.herramienta_aid h
         JOIN ref.tipo_herramienta_aid t ON t.id = h.id_tipo_herramienta_aid
         JOIN org.unidad u ON u.id = h.id_unidad
         LEFT JOIN ref.municipio m ON m.id = h.id_municipio
         LEFT JOIN ref.estado_herramienta_aid e ON e.id = h.id_estado_herramienta
         -- RLS también aquí: un responsable de otra unidad no se ve, y la fila
         -- sale sin él en lugar de revelar sus datos.
         LEFT JOIN ai.personal p ON p.id = h.id_personal_responsable
         LEFT JOIN ref.grado g ON g.id = p.id_grado
         LEFT JOIN ref.tipo_documento_identidad d ON d.id = p.id_tipo_documento_identidad
        WHERE h.id_estado_registro = (SELECT id FROM ref.estado_registro WHERE codigo = 'ACTIVO')
          AND ($1 = '' OR ref.normalizar_texto(h.nombre) LIKE '%' || ref.normalizar_texto($1) || '%'
               OR h.codigo LIKE $1 || '%')
        ORDER BY h.fecha_registro DESC, h.nombre
        LIMIT 200`,
      [buscar],
    );
    return {
      filas: resultado.rows.map((f) => ({
        id: Number(f.id),
        codigo: f.codigo,
        nombre: f.nombre,
        tipo: f.tipo,
        municipio: f.municipio,
        fechaRegistro: f.fecha_registro,
        unidad: f.unidad,
        // `numeric` llega como cadena en pg: sin el Number() el mapa recibe
        // texto y no dibuja el punto, en silencio.
        latitudDecimal: Number(f.latitud_decimal),
        longitudDecimal: Number(f.longitud_decimal),
        estado: f.estado,
        fechaPotenciacion: f.fecha_potenciacion,
        responsable:
          f.responsable_nombre === null || f.responsable_documento === null
            ? null
            : {
                nombre: f.responsable_nombre,
                documento: f.responsable_documento,
                correo: f.responsable_correo,
                telefono: f.responsable_telefono,
              },
      })),
      total: resultado.rowCount ?? 0,
    };
  }

  @RequierePermiso('HERRAMIENTA.CREAR')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crear(@Body() cuerpo: unknown): Promise<{ id: number }> {
    const datos = crearHerramienta.safeParse(cuerpo);
    if (!datos.success) {
      throw new BadRequestException({
        codigo: CODIGOS_ERROR.DATOS_INVALIDOS,
        mensaje: 'No se pudo registrar la herramienta AID.',
        detalles: datos.error.issues.map((i) => ({
          campo: i.path.join('.'),
          mensaje: i.message,
        })),
      });
    }
    const contexto = this.baseDatos.contextoActual;
    if (contexto === undefined) {
      throw new Error('Sin contexto de sesion. Lo fija el interceptor.');
    }
    await this.exigirReferencias(datos.data);

    try {
      const insertada = await this.baseDatos.cliente.query<{ id: string }>(
        `INSERT INTO ai.herramienta_aid (
           id_tipo_herramienta_aid, codigo, nombre, descripcion, id_unidad,
           id_municipio, id_estado_registro,
           id_estado_herramienta, fecha_potenciacion, id_personal_responsable,
           latitud_grados, latitud_minutos, latitud_segundos, latitud_hemisferio,
           longitud_grados, longitud_minutos, longitud_segundos, longitud_hemisferio)
         VALUES ($1,$2,$3,$4,$5,$6,
           (SELECT id FROM ref.estado_registro WHERE codigo = 'ACTIVO'),
           $7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING id`,
        [
          datos.data.idTipoHerramientaAid,
          datos.data.codigo,
          datos.data.nombre,
          datos.data.descripcion ?? null,
          contexto.idUnidad,
          datos.data.idMunicipio ?? null,
          datos.data.idEstadoHerramienta,
          datos.data.fechaPotenciacion,
          datos.data.idPersonalResponsable,
          datos.data.latitudGrados,
          datos.data.latitudMinutos,
          datos.data.latitudSegundos,
          datos.data.latitudHemisferio,
          datos.data.longitudGrados,
          datos.data.longitudMinutos,
          datos.data.longitudSegundos,
          datos.data.longitudHemisferio,
        ],
      );
      return { id: Number(insertada.rows[0]?.id) };
    } catch (excepcion: unknown) {
      if (esViolacionUnicidad(excepcion, 'herramienta_aid_codigo_unico')) {
        throw new ConflictException({
          codigo: CODIGOS_ERROR.CONFLICTO,
          mensaje: 'Ya existe una herramienta AID con ese código.',
        });
      }
      throw excepcion;
    }
  }

  /**
   * Lo que el esquema no puede comprobar porque depende de la base.
   *
   * Las claves foráneas ya impiden guardar un tipo, un estado o un responsable
   * inexistentes, pero lo dicen como un error interno (500) y sin señalar el
   * campo. Y no impiden tres cosas que el manual pide:
   *
   * - R8: el responsable tiene que estar inscrito en personal Y ser visible
   *   para la unidad. La clave foránea se comprueba sin RLS: sin esta
   *   consulta, una unidad podría nombrar responsable a alguien de otra
   *   unidad que no puede ver.
   * - Un tipo o un estado retirados del catálogo no admiten registros nuevos.
   * - Lámina 46: si está INACTIVA, las observaciones tienen que decir por qué.
   *   La base también lo impide, pero como error interno.
   */
  private async exigirReferencias(datos: CrearHerramienta): Promise<void> {
    const cliente = this.baseDatos.cliente;

    const tipo = await cliente.query(
      'SELECT 1 FROM ref.tipo_herramienta_aid WHERE id = $1 AND activo',
      [datos.idTipoHerramientaAid],
    );
    if (tipo.rowCount === 0) {
      throw errorDeCampo(
        CODIGOS_ERROR.DATOS_INVALIDOS,
        'El tipo de herramienta no es válido.',
        'idTipoHerramientaAid',
        'Elija uno de los tipos de la lista.',
      );
    }

    const estado = await cliente.query<{ codigo: string }>(
      'SELECT codigo FROM ref.estado_herramienta_aid WHERE id = $1 AND activo',
      [datos.idEstadoHerramienta],
    );
    const codigoEstado = estado.rows[0]?.codigo;
    if (codigoEstado === undefined) {
      throw errorDeCampo(
        CODIGOS_ERROR.DATOS_INVALIDOS,
        'El estado de la herramienta no es válido.',
        'idEstadoHerramienta',
        'Elija activa o inactiva.',
      );
    }
    if (codigoEstado === 'INACTIVA' && (datos.descripcion ?? '').trim() === '') {
      throw errorDeCampo(
        CODIGOS_ERROR.DATOS_INVALIDOS,
        'Una herramienta inactiva necesita observaciones.',
        'descripcion',
        'Diga por qué está inactiva y qué gestión se hizo para ponerla en funcionamiento o darla de baja.',
      );
    }

    const responsable = await cliente.query(
      `SELECT 1 FROM ai.personal
        WHERE id = $1
          AND id_estado_registro = (SELECT id FROM ref.estado_registro WHERE codigo = 'ACTIVO')`,
      [datos.idPersonalResponsable],
    );
    if (responsable.rowCount === 0) {
      throw errorDeCampo(
        CODIGOS_ERROR.MAESTRO_REQUERIDO,
        'El responsable tiene que estar inscrito en Personal.',
        'idPersonalResponsable',
        'Elija a alguien registrado en Tripulantes A.I. › Personal. Si no está, regístrelo primero.',
      );
    }
  }
}

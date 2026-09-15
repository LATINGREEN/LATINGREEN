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
import type { HerramientaEnListado } from '@paid/schema';
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
              h.latitud_decimal, h.longitud_decimal
         FROM ai.herramienta_aid h
         JOIN ref.tipo_herramienta_aid t ON t.id = h.id_tipo_herramienta_aid
         JOIN org.unidad u ON u.id = h.id_unidad
         LEFT JOIN ref.municipio m ON m.id = h.id_municipio
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

    try {
      const insertada = await this.baseDatos.cliente.query<{ id: string }>(
        `INSERT INTO ai.herramienta_aid (
           id_tipo_herramienta_aid, codigo, nombre, descripcion, id_unidad,
           id_municipio, fecha_registro, id_estado_registro,
           latitud_grados, latitud_minutos, latitud_segundos, latitud_hemisferio,
           longitud_grados, longitud_minutos, longitud_segundos, longitud_hemisferio)
         VALUES ($1,$2,$3,$4,$5,$6,$7,
           (SELECT id FROM ref.estado_registro WHERE codigo = 'ACTIVO'),
           $8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING id`,
        [
          datos.data.idTipoHerramientaAid,
          datos.data.codigo,
          datos.data.nombre,
          datos.data.descripcion ?? null,
          contexto.idUnidad,
          datos.data.idMunicipio ?? null,
          datos.data.fechaRegistro,
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
}

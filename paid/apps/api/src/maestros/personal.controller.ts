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
import { CODIGOS_ERROR, crearPersonal } from '@paid/schema';
import type { PersonalEnListado } from '@paid/schema';
import { BaseDatosService } from '../basedatos/basedatos.service';
import { RequierePermiso } from '../seguridad/requiere-permiso.decorator';

/**
 * Maestro 1 de 3 (R8) — Personal, «Tripulantes A.I.» en el menu del manual.
 *
 * Ninguna consulta lleva `WHERE id_unidad = ...`: RLS ya filtra por el
 * contexto que fijo el interceptor (R6/R7).
 */

interface FilaPersonal {
  readonly id: string;
  readonly numero_documento: string;
  readonly tipo_documento: string;
  readonly nombres: string;
  readonly apellidos: string;
  readonly grado: string | null;
  readonly escalafon: string | null;
  readonly unidad: string;
  readonly correo: string | null;
  readonly telefono: string | null;
}

@Controller('personal')
export class PersonalController {
  constructor(private readonly baseDatos: BaseDatosService) {}

  @RequierePermiso('PERSONAL.CONSULTAR')
  @Get()
  async listar(@Query('texto') texto?: string): Promise<{
    readonly filas: readonly PersonalEnListado[];
    readonly total: number;
  }> {
    const buscar = (texto ?? '').trim();
    const resultado = await this.baseDatos.cliente.query<FilaPersonal>(
      `SELECT p.id,
              p.numero_documento,
              td.codigo  AS tipo_documento,
              p.nombres,
              p.apellidos,
              g.nombre   AS grado,
              e.nombre   AS escalafon,
              u.sigla    AS unidad,
              p.correo,
              p.telefono
         FROM ai.personal p
         JOIN ref.tipo_documento_identidad td ON td.id = p.id_tipo_documento_identidad
         JOIN org.unidad u ON u.id = p.id_unidad
         LEFT JOIN ref.grado g ON g.id = p.id_grado
         LEFT JOIN ref.escalafon e ON e.id = p.id_escalafon
        WHERE p.id_estado_registro = (SELECT id FROM ref.estado_registro WHERE codigo = 'ACTIVO')
          AND ($1 = '' OR ref.normalizar_texto(p.apellidos || ' ' || p.nombres)
                          LIKE '%' || ref.normalizar_texto($1) || '%'
               OR p.numero_documento LIKE $1 || '%')
        ORDER BY p.apellidos, p.nombres
        LIMIT 200`,
      [buscar],
    );
    return {
      filas: resultado.rows.map((f) => ({
        id: Number(f.id),
        numeroDocumento: f.numero_documento,
        tipoDocumento: f.tipo_documento,
        nombres: f.nombres,
        apellidos: f.apellidos,
        grado: f.grado,
        escalafon: f.escalafon,
        unidad: f.unidad,
        correo: f.correo,
        telefono: f.telefono,
      })),
      total: resultado.rowCount ?? 0,
    };
  }

  @RequierePermiso('PERSONAL.CREAR')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crear(@Body() cuerpo: unknown): Promise<{ id: number }> {
    const datos = crearPersonal.safeParse(cuerpo);
    if (!datos.success) {
      throw new BadRequestException({
        codigo: CODIGOS_ERROR.DATOS_INVALIDOS,
        mensaje: 'No se pudo registrar el tripulante.',
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
      const insertado = await this.baseDatos.cliente.query<{ id: string }>(
        `INSERT INTO ai.personal (
           id_tipo_documento_identidad, numero_documento, nombres, apellidos,
           id_grado, id_escalafon, id_unidad, correo, telefono, id_estado_registro)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
           (SELECT id FROM ref.estado_registro WHERE codigo = 'ACTIVO'))
         RETURNING id`,
        [
          datos.data.idTipoDocumentoIdentidad,
          datos.data.numeroDocumento,
          datos.data.nombres,
          datos.data.apellidos,
          datos.data.idGrado ?? null,
          datos.data.idEscalafon ?? null,
          contexto.idUnidad,
          datos.data.correo ?? null,
          datos.data.telefono ?? null,
        ],
      );
      return { id: Number(insertado.rows[0]?.id) };
    } catch (excepcion: unknown) {
      /*
       * `personal_documento_unico` es UNIQUE (tipo, numero): el mismo numero
       * con distinto tipo de documento coexiste —una cedula 123 y un pasaporte
       * 123 son dos personas— y con el mismo tipo, no.
       *
       * Se traduce el 23505 a un mensaje que dice QUE hacer. «duplicate key
       * value violates unique constraint» es cierto y no sirve de nada.
       */
      if (esViolacionUnicidad(excepcion, 'personal_documento_unico')) {
        throw new ConflictException({
          codigo: CODIGOS_ERROR.CONFLICTO,
          mensaje:
            'Ya existe un tripulante con ese tipo y número de documento. ' +
            'Búsquelo en el listado antes de volver a registrarlo.',
        });
      }
      throw excepcion;
    }
  }
}

/** ¿Es el 23505 de PostgreSQL sobre una restriccion concreta? */
export function esViolacionUnicidad(excepcion: unknown, restriccion: string): boolean {
  if (typeof excepcion !== 'object' || excepcion === null) return false;
  const error = excepcion as { code?: unknown; constraint?: unknown };
  return error.code === '23505' && error.constraint === restriccion;
}

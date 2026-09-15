import { Controller, Get, Query } from '@nestjs/common';
import type { NormatividadEnListado } from '@paid/schema';
import { BaseDatosService } from '../basedatos/basedatos.service';
import { RequierePermiso } from '../seguridad/requiere-permiso.decorator';

/**
 * Normatividad A.I. — la ultima entrada del menu del manual.
 *
 * Solo lectura en la Fase 4. La CARGA de un documento (`NORMATIVIDAD.CARGAR`)
 * pasa por el mismo camino de adjuntos que R12 gobierna —extension permitida,
 * MIME real comprobado, hash, almacen— y ese modulo ya existe; conectarlo aqui
 * es trabajo de la Fase 5, cuando este decidido si la normatividad comparte la
 * cuota de R11 o tiene la suya (no esta escrito en ninguna parte).
 *
 * TODO(JACID) Q15: la cuota de 10 MB de R11 es «por actividad». La
 * normatividad no es una actividad. ¿Tiene cuota, y cual?
 *
 * `doc.normatividad` no lleva `id_unidad`: la normatividad es institucional,
 * igual para toda la Fuerza. Su politica RLS lo refleja —lectura para todos
 * los ambitos— y por eso aqui no hay filtro por unidad ni debe haberlo.
 */

interface FilaNormatividad {
  readonly id: string;
  readonly tipo: string;
  readonly codigo: string;
  readonly titulo: string;
  readonly expedida_por: string | null;
  readonly fecha_expedicion: string;
  readonly anio: number;
  readonly tiene_archivo: boolean;
}

@Controller('normatividad')
export class NormatividadController {
  constructor(private readonly baseDatos: BaseDatosService) {}

  @RequierePermiso('NORMATIVIDAD.CONSULTAR')
  @Get()
  async listar(@Query('texto') texto?: string): Promise<{
    readonly filas: readonly NormatividadEnListado[];
    readonly total: number;
  }> {
    const buscar = (texto ?? '').trim();
    const resultado = await this.baseDatos.cliente.query<FilaNormatividad>(
      `SELECT n.id, t.nombre AS tipo, n.codigo, n.titulo,
              n.descripcion AS expedida_por,
              to_char(n.fecha_expedicion, 'YYYY-MM-DD') AS fecha_expedicion,
              EXTRACT(YEAR FROM n.fecha_expedicion)::int AS anio,
              (n.ruta_objeto <> '') AS tiene_archivo
         FROM doc.normatividad n
         JOIN ref.tipo_normatividad t ON t.id = n.id_tipo_normatividad
        WHERE n.id_estado_registro = (SELECT id FROM ref.estado_registro WHERE codigo = 'ACTIVO')
          AND ($1 = '' OR ref.normalizar_texto(n.titulo) LIKE '%' || ref.normalizar_texto($1) || '%'
               OR n.codigo LIKE '%' || $1 || '%')
        ORDER BY n.fecha_expedicion DESC, n.codigo
        LIMIT 200`,
      [buscar],
    );
    return {
      filas: resultado.rows.map((f) => ({
        id: Number(f.id),
        tipo: f.tipo,
        numero: f.codigo,
        anio: f.anio,
        titulo: f.titulo,
        expedidaPor: f.expedida_por,
        fechaExpedicion: f.fecha_expedicion,
        tieneArchivo: f.tiene_archivo,
      })),
      total: resultado.rowCount ?? 0,
    };
  }
}

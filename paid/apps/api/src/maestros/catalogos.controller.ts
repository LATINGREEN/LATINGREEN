import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { CATALOGOS_EXPUESTOS, CODIGOS_ERROR } from '@paid/schema';
import type { CatalogoExpuesto, OpcionCatalogo } from '@paid/schema';
import { BaseDatosService } from '../basedatos/basedatos.service';
import { RequierePermiso } from '../seguridad/requiere-permiso.decorator';

/**
 * Lectura de los catalogos cerrados de `ref`.
 *
 * Existe por una regla del anexo: «Dominios cerrados en tablas de catalogo de
 * `ref`, nunca VARCHAR libre». Para que eso se sostenga, la interfaz tiene que
 * leer las opciones del servidor. Si llevara su propia copia, se
 * desactualizaria sin avisar y empezaria a ofrecer valores que la base
 * rechaza: el usuario veria «Datos invalidos» sobre un desplegable que el
 * propio sistema le ofrecio.
 *
 * ⚠️ La lista de catalogos legibles es BLANCA y cerrada (`CATALOGOS_EXPUESTOS`).
 * Interpolar el nombre de la tabla que llegue por la URL seria inyeccion de
 * SQL por identificador, que ningun parametro enlazado evita — un parametro
 * solo puede ser un valor, nunca un nombre de tabla.
 *
 * `ref` no lleva RLS: son catalogos, iguales para todas las unidades. Lo que
 * si lleva es el permiso mas basico de consulta, porque los catalogos revelan
 * la estructura del sistema.
 */

/**
 * Los catalogos que no siguen la forma `(id, codigo, nombre)`. Se declara el
 * nombre real de la columna en lugar de asumirlo: departamento y municipio
 * usan `codigo_dane`, y suponer `codigo` alli falla en ejecucion.
 */
const COLUMNA_CODIGO: Partial<Record<CatalogoExpuesto, string>> = {
  departamento: 'codigo_dane',
  municipio: 'codigo_dane',
};

/** Catalogos sin columna `orden`: se ordenan por nombre. */
const SIN_ORDEN: readonly CatalogoExpuesto[] = ['departamento', 'municipio'];

interface FilaOpcion {
  readonly id: number;
  readonly codigo: string;
  readonly nombre: string;
}

@Controller('catalogos')
export class CatalogosController {
  constructor(private readonly baseDatos: BaseDatosService) {}

  /** Los nombres disponibles, para que la interfaz no los lleve codificados. */
  @RequierePermiso('UNIDAD.CONSULTAR')
  @Get()
  listar(): { readonly catalogos: readonly string[] } {
    return { catalogos: CATALOGOS_EXPUESTOS };
  }

  @RequierePermiso('UNIDAD.CONSULTAR')
  @Get(':nombre')
  async opciones(
    @Param('nombre') nombre: string,
    @Query('idDepartamento') idDepartamento?: string,
  ): Promise<readonly OpcionCatalogo[]> {
    if (!(CATALOGOS_EXPUESTOS as readonly string[]).includes(nombre)) {
      throw new BadRequestException({
        codigo: CODIGOS_ERROR.DATOS_INVALIDOS,
        mensaje: 'No existe ese catálogo.',
      });
    }
    const catalogo = nombre as CatalogoExpuesto;
    const columnaCodigo = COLUMNA_CODIGO[catalogo] ?? 'codigo';
    const orden = SIN_ORDEN.includes(catalogo) ? 'nombre' : 'orden, nombre';

    // El municipio se filtra por departamento porque son ~1100: un desplegable
    // con mil opciones no es un dominio cerrado usable, es una lista.
    const filtraPorDepartamento =
      catalogo === 'municipio' && idDepartamento !== undefined && idDepartamento !== '';

    const resultado = await this.baseDatos.cliente.query<FilaOpcion>(
      `SELECT id, ${columnaCodigo} AS codigo, nombre
         FROM ref.${catalogo}
        WHERE activo${filtraPorDepartamento ? ' AND id_departamento = $1' : ''}
        ORDER BY ${orden}`,
      filtraPorDepartamento ? [idDepartamento] : [],
    );
    return resultado.rows.map((f) => ({
      id: Number(f.id),
      codigo: f.codigo,
      nombre: f.nombre,
    }));
  }
}

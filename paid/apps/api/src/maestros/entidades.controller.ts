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
import {
  CODIGOS_ERROR,
  UMBRAL_BLOQUEO_ENTIDAD,
  UMBRAL_SEMEJANZA_ENTIDAD,
  crearEntidad,
} from '@paid/schema';
import type { EntidadEnListado, EntidadSemejante } from '@paid/schema';
import { BaseDatosService } from '../basedatos/basedatos.service';
import { RequierePermiso } from '../seguridad/requiere-permiso.decorator';
import { esViolacionUnicidad } from './personal.controller';

/**
 * Maestro 2 de 3 (R8) — Entidades de Accion Integral.
 *
 * ⚠️ Aqui vive la unica pieza de la Fase 4 que no es «una pantalla mas»:
 * «Entidades A.I. (con sugerencia de duplicados por semejanza ANTES de
 * guardar)».
 *
 * Por que importa y no es un adorno de comodidad: `ai.entidad` es un maestro
 * de precedencia, asi que cada actividad apunta a una de estas filas. Si la
 * «ALCALDIA DE TUMACO» queda registrada dos veces, las actividades se reparten
 * entre las dos y los consolidados del RAO tambien. No falla nada: salen dos
 * cifras donde debia salir una, y cada una parece correcta. Es exactamente el
 * defecto que PROMPT.md describe en su advertencia final.
 *
 * ── Tres decisiones de esta implementacion ──────────────────────────────────
 *
 * 1. LA SEMEJANZA LA CALCULA LA BASE, no el servidor ni el navegador. Con
 *    `similarity()` de pg_trgm sobre `nombre_normalizado`, que es una columna
 *    GENERADA con `ref.normalizar_texto` y tiene indice GIN. Comparar en el
 *    servidor exigiria traer el maestro completo, y comparar en el navegador
 *    ademas lo expondria entero, saltandose RLS.
 *
 * 2. LA CONFIRMACION SE VERIFICA EN EL SERVIDOR. Por encima de
 *    `UMBRAL_BLOQUEO_ENTIDAD` la creacion se rechaza sin `confirmoNoEsDuplicado`.
 *    Si la comprobacion viviera solo en la pantalla, un POST directo se la
 *    salta y la deduplicacion seria decorativa.
 *
 * 3. EL NOMBRE NORMALIZADO IDENTICO TAMBIEN SE BLOQUEA, con independencia de
 *    la puntuacion de semejanza. Dos nombres que normalizan igual no son
 *    «parecidos»: son el mismo nombre escrito distinto.
 */

interface FilaEntidad {
  readonly id: string;
  readonly nombre: string;
  readonly tipo: string;
  readonly nit: string | null;
  readonly municipio: string | null;
  readonly contacto: string | null;
  readonly telefono: string | null;
  readonly unidad: string;
}

interface FilaSemejante extends FilaEntidad {
  readonly semejanza: number;
  readonly mismo_nombre: boolean;
}

const SELECCION = `
  SELECT e.id, e.nombre, t.nombre AS tipo, e.nit,
         m.nombre AS municipio, e.contacto, e.telefono, u.sigla AS unidad`;

const ORIGEN = `
    FROM ai.entidad e
    JOIN ref.tipo_entidad t ON t.id = e.id_tipo_entidad
    JOIN org.unidad u ON u.id = e.id_unidad
    LEFT JOIN ref.municipio m ON m.id = e.id_municipio`;

const SOLO_ACTIVAS = `
   e.id_estado_registro = (SELECT id FROM ref.estado_registro WHERE codigo = 'ACTIVO')`;

@Controller('entidades')
export class EntidadesController {
  constructor(private readonly baseDatos: BaseDatosService) {}

  @RequierePermiso('ENTIDAD.CONSULTAR')
  @Get()
  async listar(@Query('texto') texto?: string): Promise<{
    readonly filas: readonly EntidadEnListado[];
    readonly total: number;
  }> {
    const buscar = (texto ?? '').trim();
    const resultado = await this.baseDatos.cliente.query<FilaEntidad>(
      `${SELECCION}${ORIGEN}
        WHERE ${SOLO_ACTIVAS}
          AND ($1 = '' OR e.nombre_normalizado LIKE '%' || ref.normalizar_texto($1) || '%'
               OR e.nit LIKE $1 || '%')
        ORDER BY e.nombre
        LIMIT 200`,
      [buscar],
    );
    return {
      filas: resultado.rows.map(aEntidad),
      total: resultado.rowCount ?? 0,
    };
  }

  /**
   * Fase 4, punto 3 — la sugerencia de duplicados, ANTES de guardar.
   *
   * Se consulta mientras se escribe el nombre. Devuelve las candidatas por
   * encima de `UMBRAL_SEMEJANZA_ENTIDAD` ordenadas de mas a menos parecida, y
   * dice de cada una si su nombre normalizado es identico.
   *
   * `set_local` de `pg_trgm.similarity_threshold` NO se toca: el umbral se
   * aplica en el `WHERE` con `similarity() >= $2` en lugar del operador `%`.
   * Cambiar el parametro de sesion dentro de una transaccion que el pool
   * reutiliza es la misma clase de fuga que R7 prohibe, y aqui no hace falta.
   */
  @RequierePermiso('ENTIDAD.CONSULTAR')
  @Get('semejantes')
  async semejantes(
    @Query('nombre') nombre?: string,
  ): Promise<{
    readonly candidatas: readonly EntidadSemejante[];
    readonly umbralAviso: number;
    readonly umbralBloqueo: number;
  }> {
    const buscado = (nombre ?? '').trim();
    // Con menos de tres caracteres cualquier cosa se parece a todo: un
    // trigrama necesita tres. Devolver candidatas ahi seria ruido que enseña a
    // ignorar el aviso.
    if (buscado.length < 3) {
      return {
        candidatas: [],
        umbralAviso: UMBRAL_SEMEJANZA_ENTIDAD,
        umbralBloqueo: UMBRAL_BLOQUEO_ENTIDAD,
      };
    }

    const resultado = await this.baseDatos.cliente.query<FilaSemejante>(
      `${SELECCION},
              similarity(e.nombre_normalizado, ref.normalizar_texto($1)) AS semejanza,
              e.nombre_normalizado = ref.normalizar_texto($1) AS mismo_nombre
         ${ORIGEN}
        WHERE ${SOLO_ACTIVAS}
          AND (similarity(e.nombre_normalizado, ref.normalizar_texto($1)) >= $2
               OR e.nombre_normalizado = ref.normalizar_texto($1))
        ORDER BY mismo_nombre DESC, semejanza DESC, e.nombre
        LIMIT 8`,
      [buscado, UMBRAL_SEMEJANZA_ENTIDAD],
    );

    return {
      candidatas: resultado.rows.map((f) => ({
        ...aEntidad(f),
        semejanza: Number(f.semejanza),
        mismoNombre: f.mismo_nombre,
      })),
      umbralAviso: UMBRAL_SEMEJANZA_ENTIDAD,
      umbralBloqueo: UMBRAL_BLOQUEO_ENTIDAD,
    };
  }

  @RequierePermiso('ENTIDAD.CREAR')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crear(@Body() cuerpo: unknown): Promise<{ id: number }> {
    const datos = crearEntidad.safeParse(cuerpo);
    if (!datos.success) {
      throw new BadRequestException({
        codigo: CODIGOS_ERROR.DATOS_INVALIDOS,
        mensaje: 'No se pudo registrar la entidad.',
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

    /*
     * La comprobacion de duplicados se repite EN EL SERVIDOR, no se confia en
     * que la pantalla la hizo. El cliente puede haberla mostrado, ignorado, o
     * no existir: esta peticion puede llegar de cualquier sitio.
     */
    if (!datos.data.confirmoNoEsDuplicado) {
      const revision = await this.semejantes(datos.data.nombre);
      const bloqueantes = revision.candidatas.filter(
        (c) => c.mismoNombre || c.semejanza >= UMBRAL_BLOQUEO_ENTIDAD,
      );
      if (bloqueantes.length > 0) {
        throw new ConflictException({
          codigo: CODIGOS_ERROR.CONFLICTO,
          mensaje:
            bloqueantes.length === 1
              ? `Ya existe «${bloqueantes[0]?.nombre ?? ''}», que puede ser la misma ` +
                'entidad. Revísela; si de verdad es distinta, confirme y vuelva a guardar.'
              : `Existen ${bloqueantes.length} entidades que pueden ser la misma. ` +
                'Revíselas; si de verdad es distinta, confirme y vuelva a guardar.',
          // Se devuelven las candidatas para que la pantalla las muestre sin
          // una segunda consulta, y para que un cliente que no las pidio antes
          // las reciba ahora.
          detalles: bloqueantes,
        });
      }
    }

    try {
      const insertada = await this.baseDatos.cliente.query<{ id: string }>(
        `INSERT INTO ai.entidad (
           id_tipo_entidad, nit, nombre, id_unidad, id_municipio,
           direccion, telefono, correo, contacto, id_estado_registro)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
           (SELECT id FROM ref.estado_registro WHERE codigo = 'ACTIVO'))
         RETURNING id`,
        [
          datos.data.idTipoEntidad,
          datos.data.nit ?? null,
          datos.data.nombre,
          contexto.idUnidad,
          datos.data.idMunicipio ?? null,
          datos.data.direccion ?? null,
          datos.data.telefono ?? null,
          datos.data.correo ?? null,
          datos.data.contacto ?? null,
        ],
      );
      return { id: Number(insertada.rows[0]?.id) };
    } catch (excepcion: unknown) {
      /*
       * El NIT es UNIQUE global, no por unidad. Aqui hay un caso que el
       * mensaje tiene que resolver con cuidado: la entidad con ese NIT puede
       * existir en OTRA unidad, y RLS impide verla. Decir «ya existe, búsquela
       * en el listado» mandaria a buscar algo invisible. Se dice lo que se
       * puede hacer.
       */
      if (esViolacionUnicidad(excepcion, 'entidad_nit_unico')) {
        throw new ConflictException({
          codigo: CODIGOS_ERROR.CONFLICTO,
          mensaje:
            'Ese NIT ya está registrado. Si no aparece en el listado, la entidad la ' +
            'registró otra unidad: solicite a JACID que la habilite en lugar de ' +
            'crearla de nuevo.',
        });
      }
      throw excepcion;
    }
  }
}

function aEntidad(f: FilaEntidad): EntidadEnListado {
  return {
    id: Number(f.id),
    nombre: f.nombre,
    tipo: f.tipo,
    nit: f.nit,
    municipio: f.municipio,
    contacto: f.contacto,
    telefono: f.telefono,
    unidad: f.unidad,
  };
}

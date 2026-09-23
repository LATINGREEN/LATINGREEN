import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CODIGOS_ERROR,
  ESQUEMA_POR_PESTANA,
  PESTANAS_ACTIVIDAD,
  evaluarPestanas,
} from '@paid/schema';
import type {
  ActualizarJornada,
  CrearJornada,
  FilaPestana,
  FiltroJornadas,
  JornadaDetalle,
  JornadaEnListado,
  PestanaActividad,
  PestanaConDatos,
} from '@paid/schema';
import { BaseDatosService } from '../basedatos/basedatos.service';
import { GeneradorCodigoObservado } from '../comun/generador-codigo';
import { MAPA_PESTANAS, REFERENCIA_DE_COLUMNA } from './pestanas.mapa';

/** El tipo de actividad JORNADA_APOYO. Fijo en la migracion 0006 (P1). */
const TIPO_JORNADA_APOYO = 1;

interface FilaListado {
  readonly id: string;
  readonly codigo_actividad: string;
  readonly unidad: string;
  readonly descripcion: string;
  readonly fecha_inicio: string;
  readonly fecha_ejecucion: string;
  readonly lugar: string;
  readonly municipio: string | null;
  readonly tipo_jornada: string | null;
  readonly participo_ejc: boolean | null;
  readonly participo_fac: boolean | null;
  readonly poblacion_afecta_tropa: boolean | null;
  readonly registro_completo: boolean;
  readonly latitud_decimal: string;
  readonly longitud_decimal: string;
  readonly pestanas_con_datos: string[];
}

@Injectable()
export class JornadasService {
  constructor(
    private readonly baseDatos: BaseDatosService,
    private readonly generadorCodigo: GeneradorCodigoObservado,
  ) {}

  /**
   * Crea la actividad y su subtipo **en la misma transaccion**.
   *
   * Tiene que ser la misma: el disparador `actividad_exige_subtipo` es
   * `DEFERRABLE INITIALLY DEFERRED` y comprueba al confirmar que la actividad
   * tiene su fila de subtipo (P1). En dos transacciones, la primera fallaria.
   *
   * La transaccion la abre `TransaccionInterceptor` con el contexto de R7, asi
   * que aqui no hay BEGIN: ya estamos dentro.
   */
  async crear(datos: CrearJornada): Promise<{ id: number; codigoActividad: string }> {
    const cliente = this.baseDatos.cliente;
    const contexto = this.baseDatos.contextoActual;
    if (contexto === undefined) {
      throw new Error('Sin contexto de sesion. No deberia ocurrir: lo fija el interceptor.');
    }

    await this.exigirTipoJornadaVigente(datos.idTipoJornada);

    const unidad = await cliente.query<{ codigo: string }>(
      'SELECT codigo FROM org.unidad WHERE id = $1',
      [contexto.idUnidad],
    );
    const codigoUnidad = unidad.rows[0]?.codigo;
    if (codigoUnidad === undefined) {
      // RLS no deberia ocultar la propia unidad de la sesion.
      throw new Error(`No se pudo leer la unidad ${contexto.idUnidad} de la sesion.`);
    }

    /*
     * Q1 — unicidad por REINTENTO sobre la restriccion UNIQUE.
     *
     * No se comprueba «¿existe ya?» y luego se inserta: entre las dos
     * sentencias otra peticion puede tomar el mismo codigo. Se intenta
     * insertar y se reintenta si la base lo rechaza, que es la unica forma
     * correcta cuando la garantia la da un indice unico.
     */
    let idActividad: number | undefined;
    let codigoActividad = '';
    for (let intento = 0; intento < this.generadorCodigo.reintentos; intento += 1) {
      codigoActividad = this.generadorCodigo.generar({
        codigoUnidad,
        fecha: new Date(`${datos.fechaEjecucion}T00:00:00Z`),
      });
      try {
        // Cada intento en su propio punto de guardado: un fallo de unicidad
        // aborta la sentencia, y sin el SAVEPOINT abortaria la transaccion
        // entera y con ella la actividad.
        await cliente.query('SAVEPOINT intento_codigo');
        const insertada = await cliente.query<{ id: string }>(
          `INSERT INTO ai.actividad (
             id_tipo_actividad, codigo_actividad, id_unidad, descripcion,
             fecha_inicio, fecha_fin, participo_arc, id_municipio, id_estado_registro,
             latitud_grados, latitud_minutos, latitud_segundos, latitud_hemisferio,
             longitud_grados, longitud_minutos, longitud_segundos, longitud_hemisferio)
           VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7,
             (SELECT id FROM ref.estado_registro WHERE codigo = 'ACTIVO'),
             $8,$9,$10,$11,$12,$13,$14,$15)
           RETURNING id`,
          [
            TIPO_JORNADA_APOYO,
            codigoActividad,
            contexto.idUnidad,
            datos.descripcion,
            datos.fechaInicio,
            datos.fechaFin ?? null,
            datos.idMunicipio ?? null,
            datos.latitudGrados,
            datos.latitudMinutos,
            datos.latitudSegundos,
            datos.latitudHemisferio,
            datos.longitudGrados,
            datos.longitudMinutos,
            datos.longitudSegundos,
            datos.longitudHemisferio,
          ],
        );
        await cliente.query('RELEASE SAVEPOINT intento_codigo');
        idActividad = Number(insertada.rows[0]?.id);
        break;
      } catch (error: unknown) {
        await cliente.query('ROLLBACK TO SAVEPOINT intento_codigo');
        const codigoSql = (error as { code?: string }).code;
        // 23505 = violacion de unicidad. Cualquier otro error no es una
        // colision y no se debe reintentar.
        if (codigoSql !== '23505') throw error;
      }
    }

    if (idActividad === undefined) {
      throw new ConflictException({
        codigo: CODIGOS_ERROR.CONFLICTO,
        mensaje:
          'No se pudo generar un código de actividad único tras varios intentos. ' +
          'Reintente. Si persiste, reporte la incidencia.',
      });
    }

    await cliente.query(
      `INSERT INTO ai.jornada_apoyo (
         id_actividad, fecha_ejecucion, lugar, observaciones,
         id_tipo_jornada, participo_ejc, participo_fac, poblacion_afecta_tropa)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        idActividad,
        datos.fechaEjecucion,
        datos.lugar,
        datos.observaciones ?? null,
        datos.idTipoJornada,
        datos.participoEjc,
        datos.participoFac,
        datos.poblacionAfectaTropa,
      ],
    );

    // R18 — cero a muchos, y la lista vacia es legitima.
    for (const coami of datos.coami) {
      await cliente.query(
        `INSERT INTO ai.actividad_coami (id_actividad, id_coami)
         VALUES ($1, (SELECT id FROM ref.coami WHERE codigo = $2))`,
        [idActividad, coami],
      );
    }

    return { id: idActividad, codigoActividad };
  }

  async actualizar(idActividad: number, datos: ActualizarJornada): Promise<void> {
    const cliente = this.baseDatos.cliente;
    await this.exigirQueExista(idActividad);
    if (datos.idTipoJornada !== undefined) await this.exigirTipoJornadaVigente(datos.idTipoJornada);

    const camposActividad: Record<string, unknown> = {};
    if (datos.descripcion !== undefined) camposActividad['descripcion'] = datos.descripcion;
    if (datos.fechaInicio !== undefined) camposActividad['fecha_inicio'] = datos.fechaInicio;
    if (datos.fechaFin !== undefined) camposActividad['fecha_fin'] = datos.fechaFin;
    if (datos.idMunicipio !== undefined) camposActividad['id_municipio'] = datos.idMunicipio;
    for (const campo of [
      'latitudGrados', 'latitudMinutos', 'latitudSegundos', 'latitudHemisferio',
      'longitudGrados', 'longitudMinutos', 'longitudSegundos', 'longitudHemisferio',
    ] as const) {
      const valor = datos[campo];
      if (valor !== undefined) {
        camposActividad[campo.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`)] = valor;
      }
    }

    if (Object.keys(camposActividad).length > 0) {
      const claves = Object.keys(camposActividad);
      const asignaciones = claves.map((c, i) => `${c} = $${i + 2}`).join(', ');
      await cliente.query(
        `UPDATE ai.actividad SET ${asignaciones} WHERE id = $1`,
        [idActividad, ...claves.map((c) => camposActividad[c])],
      );
    }

    const camposJornada: Record<string, unknown> = {};
    if (datos.fechaEjecucion !== undefined) camposJornada['fecha_ejecucion'] = datos.fechaEjecucion;
    if (datos.lugar !== undefined) camposJornada['lugar'] = datos.lugar;
    if (datos.observaciones !== undefined) camposJornada['observaciones'] = datos.observaciones;
    if (datos.idTipoJornada !== undefined) camposJornada['id_tipo_jornada'] = datos.idTipoJornada;
    if (datos.participoEjc !== undefined) camposJornada['participo_ejc'] = datos.participoEjc;
    if (datos.participoFac !== undefined) camposJornada['participo_fac'] = datos.participoFac;
    if (datos.poblacionAfectaTropa !== undefined) {
      camposJornada['poblacion_afecta_tropa'] = datos.poblacionAfectaTropa;
    }

    if (Object.keys(camposJornada).length > 0) {
      const claves = Object.keys(camposJornada);
      const asignaciones = claves.map((c, i) => `${c} = $${i + 2}`).join(', ');
      await cliente.query(
        `UPDATE ai.jornada_apoyo SET ${asignaciones} WHERE id_actividad = $1`,
        [idActividad, ...claves.map((c) => camposJornada[c])],
      );
    }

    if (datos.coami !== undefined) {
      await cliente.query('DELETE FROM ai.actividad_coami WHERE id_actividad = $1', [idActividad]);
      for (const coami of datos.coami) {
        await cliente.query(
          `INSERT INTO ai.actividad_coami (id_actividad, id_coami)
           VALUES ($1, (SELECT id FROM ref.coami WHERE codigo = $2))`,
          [idActividad, coami],
        );
      }
    }
  }

  /**
   * Anade una fila a una pestaña.
   *
   * El SQL se compone desde `MAPA_PESTANAS`, no se concatena con datos del
   * usuario: los nombres de tabla y columna salen del mapa —valores del
   * codigo— y los valores viajan como parametros vinculados.
   */
  async agregarFilaPestana(
    idActividad: number,
    pestana: PestanaConDatos,
    datosCrudos: unknown,
  ): Promise<{ id: number }> {
    await this.exigirQueExista(idActividad);

    const esquema = ESQUEMA_POR_PESTANA[pestana];
    const validado = esquema.safeParse(datosCrudos);
    if (!validado.success) {
      throw new BadRequestException({
        codigo: CODIGOS_ERROR.DATOS_INVALIDOS,
        mensaje: `Datos inválidos para la pestaña ${pestana}.`,
        detalles: validado.error.issues.map((i) => ({
          campo: i.path.join('.'),
          mensaje: i.message,
        })),
      });
    }

    const definicion = MAPA_PESTANAS[pestana];
    const datos = validado.data as Record<string, unknown>;

    const columnas: string[] = [];
    const valores: unknown[] = [];
    for (const [campo, columna] of Object.entries(definicion.columnas)) {
      if (datos[campo] !== undefined) {
        columnas.push(columna);
        valores.push(datos[campo]);
      }
    }

    const marcadores = valores.map((_, i) => `$${i + 2}`).join(', ');
    const devolver = definicion.unoAUno === true ? 'id_actividad' : 'id';

    /*
     * La pestaña Resumen es uno a uno: reenviarla no es un duplicado, es una
     * correccion. De ahi el ON CONFLICT.
     */
    const conflicto =
      definicion.unoAUno === true
        ? `ON CONFLICT (id_actividad) DO UPDATE SET ${columnas
            .map((c) => `${c} = EXCLUDED.${c}`)
            .join(', ')}`
        : '';

    try {
      const insertada = await this.baseDatos.cliente.query<Record<string, string>>(
        `INSERT INTO ai.${definicion.tabla} (id_actividad${columnas.length > 0 ? ', ' + columnas.join(', ') : ''})
         VALUES ($1${valores.length > 0 ? ', ' + marcadores : ''})
         ${conflicto}
         RETURNING ${devolver}`,
        [idActividad, ...valores],
      );
      return { id: Number(insertada.rows[0]?.[devolver]) };
    } catch (error: unknown) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException({
          codigo: CODIGOS_ERROR.CONFLICTO,
          mensaje:
            `Esa entrada ya está registrada en la pestaña ${pestana}. ` +
            'Modifique la existente en lugar de añadirla de nuevo.',
        });
      }
      throw error;
    }
  }

  async eliminarFilaPestana(
    idActividad: number,
    pestana: PestanaConDatos,
    idFila: number,
  ): Promise<void> {
    const definicion = MAPA_PESTANAS[pestana];
    const columnaId = definicion.unoAUno === true ? 'id_actividad' : 'id';
    const resultado = await this.baseDatos.cliente.query(
      `DELETE FROM ai.${definicion.tabla} WHERE ${columnaId} = $1 AND id_actividad = $2`,
      [idFila, idActividad],
    );
    if (resultado.rowCount === 0) {
      throw new NotFoundException({
        codigo: CODIGOS_ERROR.RECURSO_NO_ENCONTRADO,
        mensaje: 'No se encontró la fila.',
      });
    }
  }

  /**
   * Los datos generales de una jornada, para diligenciar sus pestañas con el
   * clavegrama a la vista.
   */
  async detalle(idActividad: number): Promise<JornadaDetalle> {
    await this.exigirQueExista(idActividad);
    const cliente = this.baseDatos.cliente;
    const r = await cliente.query<{
      id: string;
      codigo_actividad: string;
      unidad: string;
      descripcion: string;
      fecha_inicio: string;
      fecha_fin: string | null;
      fecha_ejecucion: string;
      lugar: string;
      observaciones: string | null;
      id_municipio: number | null;
      id_departamento: number | null;
      municipio: string | null;
      id_tipo_jornada: number | null;
      tipo_jornada: string | null;
      participo_ejc: boolean | null;
      participo_fac: boolean | null;
      poblacion_afecta_tropa: boolean | null;
      latitud_grados: number;
      latitud_minutos: number;
      latitud_segundos: string;
      latitud_hemisferio: string;
      longitud_grados: number;
      longitud_minutos: number;
      longitud_segundos: string;
      longitud_hemisferio: string;
      latitud_decimal: string;
      longitud_decimal: string;
      registro_completo: boolean;
    }>(
      `SELECT a.id, a.codigo_actividad, u.sigla AS unidad, a.descripcion,
              a.fecha_inicio::text, a.fecha_fin::text, j.fecha_ejecucion::text,
              j.lugar, j.observaciones, a.id_municipio, m.id_departamento,
              m.nombre AS municipio,
              j.id_tipo_jornada, tj.nombre AS tipo_jornada,
              j.participo_ejc, j.participo_fac, j.poblacion_afecta_tropa,
              a.latitud_grados, a.latitud_minutos, a.latitud_segundos::text,
              a.latitud_hemisferio, a.longitud_grados, a.longitud_minutos,
              a.longitud_segundos::text, a.longitud_hemisferio,
              a.latitud_decimal::text, a.longitud_decimal::text,
              a.registro_completo
         FROM ai.actividad a
         JOIN ai.jornada_apoyo j ON j.id_actividad = a.id
         JOIN org.unidad u ON u.id = a.id_unidad
         LEFT JOIN ref.municipio m ON m.id = a.id_municipio
         LEFT JOIN ref.tipo_jornada tj ON tj.id = j.id_tipo_jornada
        WHERE a.id = $1`,
      [idActividad],
    );
    const fila = r.rows[0];
    if (fila === undefined) {
      throw new NotFoundException({
        codigo: CODIGOS_ERROR.RECURSO_NO_ENCONTRADO,
        mensaje: 'No se encontró la jornada.',
      });
    }
    const coami = await cliente.query<{ codigo: string }>(
      `SELECT c.codigo FROM ai.actividad_coami ac
         JOIN ref.coami c ON c.id = ac.id_coami
        WHERE ac.id_actividad = $1 ORDER BY c.orden, c.codigo`,
      [idActividad],
    );
    return {
      id: Number(fila.id),
      codigoActividad: fila.codigo_actividad,
      unidad: fila.unidad,
      descripcion: fila.descripcion,
      fechaInicio: fila.fecha_inicio,
      fechaFin: fila.fecha_fin,
      fechaEjecucion: fila.fecha_ejecucion,
      lugar: fila.lugar,
      observaciones: fila.observaciones,
      idMunicipio: fila.id_municipio === null ? null : Number(fila.id_municipio),
      idDepartamento: fila.id_departamento === null ? null : Number(fila.id_departamento),
      municipio: fila.municipio,
      idTipoJornada: fila.id_tipo_jornada === null ? null : Number(fila.id_tipo_jornada),
      tipoJornada: fila.tipo_jornada,
      participoEjc: fila.participo_ejc,
      participoFac: fila.participo_fac,
      poblacionAfectaTropa: fila.poblacion_afecta_tropa,
      latitudGrados: Number(fila.latitud_grados),
      latitudMinutos: Number(fila.latitud_minutos),
      latitudSegundos: Number(fila.latitud_segundos),
      latitudHemisferio: fila.latitud_hemisferio,
      longitudGrados: Number(fila.longitud_grados),
      longitudMinutos: Number(fila.longitud_minutos),
      longitudSegundos: Number(fila.longitud_segundos),
      longitudHemisferio: fila.longitud_hemisferio,
      latitudDecimal: Number(fila.latitud_decimal),
      longitudDecimal: Number(fila.longitud_decimal),
      coami: coami.rows.map((c) => c.codigo),
      registroCompleto: fila.registro_completo,
    };
  }

  /**
   * Las filas ya registradas en una pestaña, con el NOMBRE de cada cosa a la
   * que apuntan.
   *
   * Sin esto, al pulsar «Añadir registro» la fila desaparecía del formulario
   * y no quedaba en ningún sitio visible: la persona no podía comprobar lo que
   * había registrado ni corregir un error. Y quitar una fila exigía conocer su
   * identificador, que no aparecía en ninguna parte.
   */
  async filasPestana(
    idActividad: number,
    pestana: PestanaConDatos,
  ): Promise<readonly FilaPestana[]> {
    await this.exigirQueExista(idActividad);
    const definicion = MAPA_PESTANAS[pestana];
    const columnaId = definicion.unoAUno === true ? 'id_actividad' : 'id';

    const selecciones = [`t.${columnaId} AS "__id"`];
    for (const [campo, columna] of Object.entries(definicion.columnas)) {
      selecciones.push(`t.${columna} AS "${campo}"`);
      const referencia = REFERENCIA_DE_COLUMNA[columna];
      if (referencia !== undefined) {
        // Subconsulta y no JOIN: una fila cuya referencia RLS oculte sigue
        // apareciendo, con el nombre vacío, en lugar de desaparecer del
        // listado y dejar una pestaña «con datos» que no muestra ninguno.
        selecciones.push(
          `(SELECT r.nombre FROM ${referencia} r WHERE r.id = t.${columna}) AS "__nombre_${campo}"`,
        );
      }
    }

    const r = await this.baseDatos.cliente.query<Record<string, unknown>>(
      `SELECT ${selecciones.join(', ')}
         FROM ai.${definicion.tabla} t
        WHERE t.id_actividad = $1
        ORDER BY 1`,
      [idActividad],
    );

    return r.rows.map((fila) => {
      const campos: Record<string, string | number | null> = {};
      const nombres: Record<string, string> = {};
      for (const campo of Object.keys(definicion.columnas)) {
        const valor = fila[campo];
        campos[campo] =
          valor === null || valor === undefined
            ? null
            : typeof valor === 'number'
              ? valor
              : String(valor);
        const nombre = fila[`__nombre_${campo}`];
        if (typeof nombre === 'string') nombres[campo] = nombre;
      }
      return { id: Number(fila['__id']), campos, nombres };
    });
  }

  /** Estado de las once pestañas, para pintar el aviso de R19. */
  async estadoPestanas(idActividad: number): Promise<{
    registroCompleto: boolean;
    faltantes: readonly PestanaActividad[];
    completas: readonly PestanaActividad[];
  }> {
    await this.exigirQueExista(idActividad);
    const conDatos = await this.pestanasConDatos(idActividad);
    const estado = evaluarPestanas(conDatos);

    // `registro_completo` de la base es la fuente de verdad; esto es
    // presentacion. Se devuelve el valor de la base y no el calculado, para
    // que una discrepancia se vea en lugar de quedar disimulada.
    const fila = await this.baseDatos.cliente.query<{ registro_completo: boolean }>(
      'SELECT registro_completo FROM ai.actividad WHERE id = $1',
      [idActividad],
    );
    return {
      registroCompleto: fila.rows[0]?.registro_completo ?? false,
      faltantes: estado.faltantes,
      completas: estado.completas,
    };
  }

  private async pestanasConDatos(idActividad: number): Promise<PestanaActividad[]> {
    const cliente = this.baseDatos.cliente;
    const conDatos: PestanaActividad[] = [];

    // Adjuntos: solo los VIGENTES cuentan (R14 + R11).
    const adjuntos = await cliente.query<{ n: string }>(
      `SELECT count(*) AS n FROM ai.act_adjunto a
         JOIN ref.estado_registro e ON e.id = a.id_estado_registro
        WHERE a.id_actividad = $1 AND e.codigo = 'ACTIVO'`,
      [idActividad],
    );
    if (Number(adjuntos.rows[0]?.n ?? 0) > 0) conDatos.push('ARCHIVOS_ADJUNTOS');

    for (const [pestana, definicion] of Object.entries(MAPA_PESTANAS)) {
      const r = await cliente.query<{ n: string }>(
        `SELECT count(*) AS n FROM ai.${definicion.tabla} WHERE id_actividad = $1`,
        [idActividad],
      );
      if (Number(r.rows[0]?.n ?? 0) > 0) conDatos.push(pestana as PestanaActividad);
    }
    return conDatos;
  }

  /** Listado con las columnas del manual, y el aviso de incompletos (R19). */
  async listar(filtro: FiltroJornadas): Promise<{
    filas: readonly JornadaEnListado[];
    total: number;
  }> {
    const condiciones: string[] = ['a.id_tipo_actividad = $1'];
    const valores: unknown[] = [TIPO_JORNADA_APOYO];

    const agregar = (condicion: (indice: number) => string, valor: unknown): void => {
      valores.push(valor);
      condiciones.push(condicion(valores.length));
    };

    if (filtro.desde !== undefined) agregar((i) => `a.fecha_inicio >= $${i}`, filtro.desde);
    if (filtro.hasta !== undefined) agregar((i) => `a.fecha_inicio <= $${i}`, filtro.hasta);
    if (filtro.idMunicipio !== undefined) agregar((i) => `a.id_municipio = $${i}`, filtro.idMunicipio);
    if (filtro.soloCompletas === true) condiciones.push('a.registro_completo');
    if (filtro.texto !== undefined && filtro.texto !== '') {
      agregar(
        (i) => `(a.descripcion ILIKE '%' || $${i} || '%' OR a.codigo_actividad ILIKE '%' || $${i} || '%')`,
        filtro.texto,
      );
    }

    const donde = condiciones.join(' AND ');
    const cliente = this.baseDatos.cliente;

    const total = await cliente.query<{ n: string }>(
      `SELECT count(*) AS n FROM ai.actividad a WHERE ${donde}`,
      valores,
    );

    const desplazamiento = (filtro.pagina - 1) * filtro.porPagina;
    const resultado = await cliente.query<FilaListado>(
      `SELECT a.id, a.codigo_actividad, u.sigla AS unidad, a.descripcion,
              a.fecha_inicio::text, j.fecha_ejecucion::text, j.lugar,
              m.nombre AS municipio, tj.nombre AS tipo_jornada,
              j.participo_ejc, j.participo_fac, j.poblacion_afecta_tropa,
              a.registro_completo,
              a.latitud_decimal::text, a.longitud_decimal::text
         FROM ai.actividad a
         JOIN ai.jornada_apoyo j ON j.id_actividad = a.id
         JOIN org.unidad u ON u.id = a.id_unidad
         LEFT JOIN ref.municipio m ON m.id = a.id_municipio
         LEFT JOIN ref.tipo_jornada tj ON tj.id = j.id_tipo_jornada
        WHERE ${donde}
        ORDER BY a.fecha_inicio DESC, a.id DESC
        LIMIT ${filtro.porPagina} OFFSET ${desplazamiento}`,
      valores,
    );

    const filas: JornadaEnListado[] = [];
    for (const fila of resultado.rows) {
      const conDatos = await this.pestanasConDatos(Number(fila.id));
      filas.push({
        id: Number(fila.id),
        codigoActividad: fila.codigo_actividad,
        unidad: fila.unidad,
        descripcion: fila.descripcion,
        fechaInicio: fila.fecha_inicio,
        fechaEjecucion: fila.fecha_ejecucion,
        lugar: fila.lugar,
        municipio: fila.municipio,
        tipoJornada: fila.tipo_jornada,
        participoEjc: fila.participo_ejc,
        participoFac: fila.participo_fac,
        poblacionAfectaTropa: fila.poblacion_afecta_tropa,
        registroCompleto: fila.registro_completo,
        pestanasFaltantes: PESTANAS_ACTIVIDAD.filter((p) => !conDatos.includes(p)),
        latitudDecimal: Number(fila.latitud_decimal),
        longitudDecimal: Number(fila.longitud_decimal),
      });
    }

    return { filas, total: Number(total.rows[0]?.n ?? 0) };
  }

  /**
   * El tipo de jornada tiene que existir en `ref.tipo_jornada` y estar
   * vigente.
   *
   * La clave foránea ya impide guardar uno inexistente, pero lo dice como una
   * violación de restricción que llega al cliente como error interno (500). Y
   * no impide elegir uno retirado (`activo = FALSE`): una entrada de catálogo
   * retirada existe por las filas históricas que la citan, no para que se
   * sigan registrando jornadas con ella.
   */
  private async exigirTipoJornadaVigente(idTipoJornada: number): Promise<void> {
    const r = await this.baseDatos.cliente.query(
      'SELECT 1 FROM ref.tipo_jornada WHERE id = $1 AND activo',
      [idTipoJornada],
    );
    if (r.rowCount === 0) {
      throw new BadRequestException({
        codigo: CODIGOS_ERROR.DATOS_INVALIDOS,
        mensaje: 'El tipo de jornada no es válido.',
        detalles: [
          {
            campo: 'idTipoJornada',
            mensaje: 'Elija binacional, conjunta o estratégica.',
          },
        ],
      });
    }
  }

  /**
   * Comprueba que la actividad existe Y es visible.
   *
   * RLS ya oculta lo que no corresponde, asi que «no existe» y «no la puede
   * ver» llegan aqui como lo mismo — y responden lo mismo. Decir «existe pero
   * no es tuya» confirmaria la existencia de datos de otra unidad.
   */
  private async exigirQueExista(idActividad: number): Promise<void> {
    const r = await this.baseDatos.cliente.query(
      'SELECT 1 FROM ai.actividad WHERE id = $1 AND id_tipo_actividad = $2',
      [idActividad, TIPO_JORNADA_APOYO],
    );
    if (r.rowCount === 0) {
      throw new NotFoundException({
        codigo: CODIGOS_ERROR.RECURSO_NO_ENCONTRADO,
        mensaje: 'No se encontró la jornada.',
      });
    }
  }
}

import type { PestanaConDatos } from '@paid/schema';

/**
 * R19 — Donde vive cada pestaña y con qué columnas.
 *
 * Un MAPA y no once servicios. El motivo:
 *
 *   - Las once tablas hijas son estructuralmente iguales: cuelgan de una
 *     actividad, referencian un catálogo, y alguna lleva cantidades.
 *   - **Q4 sigue sin responder** para cinco de ellas. Cuando JACID entregue los
 *     formularios reales, cambiar un mapa es cambiar una declaración; cambiar
 *     once controladores es cambiar once archivos, y alguno se queda atrás.
 *   - Es el mismo argumento por el que `registro_completo` se calcula en un
 *     solo sitio: si la lista de pestañas vive en varios lugares, discrepan.
 *
 * `columnas` asocia el nombre del campo en el esquema Zod con el de la columna
 * en la base. No se derivan uno del otro a propósito: el esquema usa
 * `camelCase` y la base `snake_case` (A.6), y una conversión automática
 * escondería un error de nombre hasta que alguien mirara los datos.
 */
export interface DefinicionPestana {
  readonly tabla: string;
  readonly columnas: Readonly<Record<string, string>>;
  /**
   * Columnas que identifican una fila dentro de la actividad, para detectar el
   * duplicado con un mensaje claro en lugar de un error de restricción.
   * Vacío cuando la tabla admite repetidos legítimos.
   */
  readonly clave: readonly string[];
  /** Uno a uno con la actividad: la clave primaria ES la actividad. */
  readonly unoAUno?: boolean;
}

export const MAPA_PESTANAS: Readonly<Record<PestanaConDatos, DefinicionPestana>> = {
  TIPO_OPERACION: {
    tabla: 'act_tipo_operacion',
    columnas: { idTipoOperacion: 'id_tipo_operacion', observacion: 'observacion' },
    clave: ['idTipoOperacion'],
  },
  ENTIDADES_SERVICIOS: {
    tabla: 'act_entidad_servicio',
    columnas: { idEntidad: 'id_entidad', observacion: 'observacion' },
    clave: ['idEntidad'],
  },
  SERVICIOS_PRESTADOS: {
    tabla: 'act_servicio_prestado',
    columnas: {
      idServicioPrestado: 'id_servicio_prestado',
      cantidad: 'cantidad',
      observacion: 'observacion',
    },
    clave: ['idServicioPrestado'],
  },
  POBLACION_BENEFICIADA: {
    tabla: 'act_poblacion_beneficiada',
    columnas: {
      idGrupoPoblacional: 'id_grupo_poblacional',
      cantidadPersonas: 'cantidad_personas',
      observacion: 'observacion',
    },
    clave: ['idGrupoPoblacional'],
  },
  ENTIDADES_APOYADAS: {
    tabla: 'act_entidad_apoyada',
    columnas: { idEntidad: 'id_entidad', observacion: 'observacion' },
    clave: ['idEntidad'],
  },
  MEDIOS_DIFUSION: {
    tabla: 'act_medio_difusion',
    columnas: { idMedioDifusion: 'id_medio_difusion', detalle: 'detalle' },
    clave: ['idMedioDifusion'],
  },
  MEDIOS_UTILIZADOS: {
    tabla: 'act_medio_utilizado',
    columnas: {
      idMedioUtilizado: 'id_medio_utilizado',
      cantidad: 'cantidad',
      detalle: 'detalle',
    },
    clave: ['idMedioUtilizado'],
  },
  RECURSOS_UTILIZADOS: {
    tabla: 'act_recurso_utilizado',
    columnas: {
      idTipoRecurso: 'id_tipo_recurso',
      cantidad: 'cantidad',
      unidadMedida: 'unidad_medida',
      valor: 'valor',
      detalle: 'detalle',
    },
    clave: ['idTipoRecurso'],
  },
  BIENES_DONADOS: {
    tabla: 'act_bien_donado',
    columnas: {
      idTipoBienDonado: 'id_tipo_bien_donado',
      descripcion: 'descripcion',
      cantidad: 'cantidad',
      unidadMedida: 'unidad_medida',
      valorEstimado: 'valor_estimado',
      idEntidadDonante: 'id_entidad_donante',
    },
    // Sin clave: una actividad puede donar dos bienes distintos del mismo tipo.
    clave: [],
  },
  RESUMEN: {
    tabla: 'act_resumen',
    columnas: { texto: 'texto' },
    clave: [],
    unoAUno: true,
  },
};

/**
 * A qué tabla apunta cada columna de clave foránea de las pestañas, para
 * poder mostrar el NOMBRE de lo registrado y no su identificador.
 *
 * Se declara por columna y no se deduce de su nombre por la misma razón que
 * `columnas` se escribe a mano: una convención automática esconde el error
 * hasta que alguien mira los datos. Todas las tablas de aquí tienen `nombre`.
 *
 * Los nombres de tabla salen de esta constante —valores del código—, nunca de
 * la petición: se interpolan en el SQL, y un identificador no puede viajar
 * como parámetro vinculado.
 */
export const REFERENCIA_DE_COLUMNA: Readonly<Record<string, string>> = {
  id_tipo_operacion: 'ref.tipo_operacion',
  id_entidad: 'ai.entidad',
  id_servicio_prestado: 'ref.servicio_prestado',
  id_grupo_poblacional: 'ref.grupo_poblacional',
  id_medio_difusion: 'ref.medio_difusion',
  id_medio_utilizado: 'ref.medio_utilizado',
  id_tipo_recurso: 'ref.tipo_recurso',
  id_tipo_bien_donado: 'ref.tipo_bien_donado',
  id_entidad_donante: 'ai.entidad',
};

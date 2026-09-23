import { z } from 'zod';
import { coordenadaGms } from './coordenadas';
import { fechaDdMmAaaa } from './primitivos';
import { coamiParticipantes, participoArc } from './dominios';

/**
 * Jornada de Apoyo al Desarrollo: el supertipo `ai.actividad` mas el subtipo
 * `ai.jornada_apoyo`, en un solo esquema de entrada.
 *
 * Que la interfaz vea UN formulario y la base dos tablas es deliberado: el
 * usuario no tiene por que saber que existe un supertipo, y la disyuncion de
 * subtipo de P1 se resuelve en el servidor, en una transaccion.
 */
export const crearJornada = coordenadaGms.extend({
  /**
   * El clavegrama. De aqui parte U1 en la Fase 7: la extraccion propone el
   * contenido de las once pestanas leyendo este texto, para que el usuario no
   * vuelva a teclear a mano lo que ya escribio aqui.
   */
  descripcion: z.string().trim().min(1, { message: 'La descripción es obligatoria.' }).max(20000),

  fechaInicio: fechaDdMmAaaa,
  fechaFin: fechaDdMmAaaa.optional(),
  fechaEjecucion: fechaDdMmAaaa,
  lugar: z.string().trim().min(1, { message: 'El lugar es obligatorio.' }).max(250),
  observaciones: z.string().trim().max(20000).optional(),

  idMunicipio: z.coerce.number().int().positive().optional(),

  /** R9 — La ARC siempre participa. Marcado y deshabilitado en la interfaz. */
  participoArc: participoArc.default(true),

  /** R18 — Cero a muchos. Ninguno por defecto. */
  coami: coamiParticipantes,
});

export type CrearJornada = z.infer<typeof crearJornada>;

/**
 * Modificacion. No incluye `participoArc` —no se puede cambiar, R9— ni el
 * tipo de actividad, que es inmutable por disparador.
 *
 * ⚠️ `coami` se vuelve a declarar SIN valor por omision.
 *
 * `crearJornada` le pone `.default([])`, que es correcto al crear: R18 dice que
 * no se marque ninguno. Pero `.partial()` CONSERVA el valor por omision, de
 * modo que un PATCH que solo cambiaba el lugar llegaba al servicio con
 * `coami: []` — indistinguible de «quita todos»— y borraba en silencio las
 * participaciones de COAMI registradas.
 *
 * Perdida de datos silenciosa, sin error y sin que el usuario pidiera nada. La
 * detecto la Puerta 3. Aqui `coami` es `optional()` de verdad: ausente
 * significa «no lo toques», y `[]` significa «quitalos todos», que son dos
 * cosas distintas y tienen que poder expresarse por separado.
 */
export const actualizarJornada = crearJornada
  .partial()
  .omit({ participoArc: true })
  .extend({ coami: z.array(z.string()).optional() });

export type ActualizarJornada = z.infer<typeof actualizarJornada>;

/** Una fila del listado, con las columnas que el manual muestra. */
export const jornadaEnListado = z.object({
  id: z.number().int(),
  codigoActividad: z.string(),
  unidad: z.string(),
  descripcion: z.string(),
  fechaInicio: z.string(),
  fechaEjecucion: z.string(),
  lugar: z.string(),
  municipio: z.string().nullable(),
  /** R19 — el listado senala visualmente los registros incompletos. */
  registroCompleto: z.boolean(),
  /** Que pestañas faltan, para que el aviso sea util y no solo un icono. */
  pestanasFaltantes: z.array(z.string()),
  latitudDecimal: z.number(),
  longitudDecimal: z.number(),
});

export type JornadaEnListado = z.infer<typeof jornadaEnListado>;

/** Filtros del listado y de la exportacion. */
export const filtroJornadas = z.object({
  desde: fechaDdMmAaaa.optional(),
  hasta: fechaDdMmAaaa.optional(),
  idMunicipio: z.coerce.number().int().positive().optional(),
  /** Los consolidados del RAO filtran por esto (R19). */
  soloCompletas: z.coerce.boolean().optional(),
  texto: z.string().trim().max(200).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(500).default(50),
});

export type FiltroJornadas = z.infer<typeof filtroJornadas>;

export const FORMATOS_EXPORTACION = ['XLSX', 'CSV'] as const;
export type FormatoExportacion = (typeof FORMATOS_EXPORTACION)[number];

/**
 * Una jornada abierta para diligenciar: los datos generales más lo que hace
 * falta para seguir.
 *
 * Existe porque sin esto el formulario de las once pestañas no mostraba el
 * clavegrama —y las once pestañas SON su transcripción—: la persona tenía que
 * volver al listado para releer lo que estaba transcribiendo.
 */
export const jornadaDetalle = z.object({
  id: z.number().int(),
  codigoActividad: z.string(),
  unidad: z.string(),
  descripcion: z.string(),
  fechaInicio: z.string(),
  fechaFin: z.string().nullable(),
  fechaEjecucion: z.string(),
  lugar: z.string(),
  observaciones: z.string().nullable(),
  idMunicipio: z.number().int().nullable(),
  idDepartamento: z.number().int().nullable(),
  municipio: z.string().nullable(),
  latitudGrados: z.number(),
  latitudMinutos: z.number(),
  latitudSegundos: z.number(),
  latitudHemisferio: z.string(),
  longitudGrados: z.number(),
  longitudMinutos: z.number(),
  longitudSegundos: z.number(),
  longitudHemisferio: z.string(),
  latitudDecimal: z.number(),
  longitudDecimal: z.number(),
  coami: z.array(z.string()),
  registroCompleto: z.boolean(),
});

export type JornadaDetalle = z.infer<typeof jornadaDetalle>;

/**
 * Una fila ya registrada en una de las diez pestañas de datos.
 *
 * `campos` trae los valores tal como están guardados, con las claves del
 * esquema de la pestaña. `nombres` trae, para cada campo que es una clave
 * foránea, el nombre legible de lo que apunta: sin él, la persona vería
 * «Tipo de operación: 3» y no podría saber si registró lo que quería.
 */
export const filaPestana = z.object({
  id: z.number().int(),
  campos: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
  nombres: z.record(z.string(), z.string()),
});

export type FilaPestana = z.infer<typeof filaPestana>;

/** Un adjunto vigente de una actividad. */
export const adjuntoEnListado = z.object({
  id: z.number().int(),
  nombreArchivo: z.string(),
  categoria: z.string(),
  pesoBytes: z.number().int(),
  faseDocumental: z.number().int(),
  cargadoEn: z.string(),
});

export type AdjuntoEnListado = z.infer<typeof adjuntoEnListado>;

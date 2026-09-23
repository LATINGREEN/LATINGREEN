import { z } from 'zod';
import { coordenadaGms } from './coordenadas';
import { fechaDdMmAaaa } from './primitivos';

/**
 * Los TRES maestros de precedencia de R8: Personal, Entidades A.I. y
 * Herramientas AID. Antes de registrar cualquier actividad deben existir.
 *
 * La Fase 4, punto 3, pide los tres, y de la entidad pide algo mas: «con
 * sugerencia de duplicados por semejanza antes de guardar».
 */

// ── Maestro 1 — Personal (Tripulantes A.I.) ────────────────────────────────

export const crearPersonal = z.object({
  idTipoDocumentoIdentidad: z.coerce.number().int().positive(),
  /*
   * Solo digitos y letras: los documentos colombianos no llevan puntos, pero
   * la costumbre de digitarlos con separador de miles es universal. Se rechaza
   * en lugar de limpiarlo en silencio, porque «1.234» y «1234» digitados por
   * dos personas distintas serian dos filas y la UNIQUE de la base no las
   * juntaria.
   */
  numeroDocumento: z
    .string()
    .trim()
    .min(3, { message: 'El número de documento es obligatorio.' })
    .max(30)
    .regex(/^[0-9A-Za-z-]+$/u, {
      message: 'Escriba el número sin puntos ni espacios. Por ejemplo: 1030512345.',
    }),
  nombres: z.string().trim().min(1, { message: 'Los nombres son obligatorios.' }).max(150),
  apellidos: z.string().trim().min(1, { message: 'Los apellidos son obligatorios.' }).max(150),
  idGrado: z.coerce.number().int().positive().optional(),
  idEscalafon: z.coerce.number().int().positive().optional(),
  correo: z.string().trim().email({ message: 'El correo no tiene un formato válido.' }).max(150).optional(),
  telefono: z.string().trim().max(30).optional(),
});

export type CrearPersonal = z.infer<typeof crearPersonal>;

export const personalEnListado = z.object({
  id: z.number().int(),
  numeroDocumento: z.string(),
  tipoDocumento: z.string(),
  nombres: z.string(),
  apellidos: z.string(),
  grado: z.string().nullable(),
  escalafon: z.string().nullable(),
  unidad: z.string(),
  correo: z.string().nullable(),
  telefono: z.string().nullable(),
});

export type PersonalEnListado = z.infer<typeof personalEnListado>;

// ── Maestro 2 — Entidades A.I. ─────────────────────────────────────────────

export const crearEntidad = z.object({
  idTipoEntidad: z.coerce.number().int().positive(),
  nombre: z.string().trim().min(3, { message: 'El nombre es obligatorio.' }).max(250),
  /*
   * El NIT es OPCIONAL a proposito, y la base lo declara igual. Hay entidades
   * sin NIT —juntas de accion comunal, organizaciones de hecho— y exigirlo
   * empuja a inventarlo, que es peor que no tenerlo.
   */
  nit: z.string().trim().max(20).optional(),
  idMunicipio: z.coerce.number().int().positive().optional(),
  direccion: z.string().trim().max(250).optional(),
  telefono: z.string().trim().max(30).optional(),
  correo: z.string().trim().email({ message: 'El correo no tiene un formato válido.' }).max(150).optional(),
  contacto: z.string().trim().max(150).optional(),
  /**
   * Confirmación explícita de que la persona vio las entidades parecidas y
   * sostiene que la suya es distinta.
   *
   * Esto es lo que convierte la sugerencia de duplicados en algo más que un
   * adorno: sin el visto bueno, el servidor RECHAZA la creación cuando hay
   * candidatos por encima del umbral. Si solo lo comprobara la pantalla,
   * bastaría con un POST directo para saltarse la deduplicación, y el maestro
   * terminaría con «ALCALDIA DE TUMACO» y «ALCALDÍA DE TUMACO» como dos
   * entidades, que es exactamente el defecto que R8 quiere evitar.
   */
  confirmoNoEsDuplicado: z.boolean().default(false),
});

export type CrearEntidad = z.infer<typeof crearEntidad>;

export const entidadEnListado = z.object({
  id: z.number().int(),
  nombre: z.string(),
  tipo: z.string(),
  nit: z.string().nullable(),
  municipio: z.string().nullable(),
  contacto: z.string().nullable(),
  telefono: z.string().nullable(),
  unidad: z.string(),
});

export type EntidadEnListado = z.infer<typeof entidadEnListado>;

/** Una entidad parecida a la que se está digitando, con su grado de semejanza. */
export const entidadSemejante = z.object({
  id: z.number().int(),
  nombre: z.string(),
  tipo: z.string(),
  nit: z.string().nullable(),
  municipio: z.string().nullable(),
  unidad: z.string(),
  /** 0 a 1. Lo calcula `similarity()` de pg_trgm sobre el nombre normalizado. */
  semejanza: z.number().min(0).max(1),
  /** Cierto cuando los nombres normalizados coinciden carácter por carácter. */
  mismoNombre: z.boolean(),
});

export type EntidadSemejante = z.infer<typeof entidadSemejante>;

/**
 * Umbral de semejanza a partir del cual se sugiere que puede ser un duplicado.
 *
 * 0,45 es bajo a propósito. El costo de los dos errores no es simétrico: una
 * sugerencia de más cuesta una lectura de dos segundos; una de menos deja dos
 * filas para la misma entidad, y a partir de ahí los consolidados del RAO
 * reparten entre las dos lo que debía ir junto. Nadie lo nota hasta que hay
 * que explicar la cifra.
 *
 * TODO(JACID) Q13: valor a calibrar con el maestro real de entidades. Este es
 * un punto de partida razonado, no un número acordado.
 */
export const UMBRAL_SEMEJANZA_ENTIDAD = 0.45;

/**
 * Umbral por encima del cual la creación se BLOQUEA salvo confirmación
 * explícita. Entre 0,45 y 0,72 se avisa; por encima de 0,72 hay que decir que
 * no es duplicado antes de guardar.
 */
export const UMBRAL_BLOQUEO_ENTIDAD = 0.72;

// ── Maestro 3 — Herramientas AID ───────────────────────────────────────────

/**
 * R13 — La herramienta AID es uno de los SEIS formularios que capturan
 * georreferenciación, y es el que se olvida, porque no es una actividad. Por
 * eso `coordenadaGms` va aquí igual que en la jornada.
 */
export const crearHerramienta = coordenadaGms.extend({
  idTipoHerramientaAid: z.coerce.number().int().positive(),
  codigo: z.string().trim().min(1, { message: 'El código es obligatorio.' }).max(40),
  nombre: z.string().trim().min(1, { message: 'El nombre es obligatorio.' }).max(250),
  descripcion: z.string().trim().max(20000).optional(),
  idMunicipio: z.coerce.number().int().positive().optional(),
  fechaRegistro: fechaDdMmAaaa,
});

export type CrearHerramienta = z.infer<typeof crearHerramienta>;

export const herramientaEnListado = z.object({
  id: z.number().int(),
  codigo: z.string(),
  nombre: z.string(),
  tipo: z.string(),
  municipio: z.string().nullable(),
  fechaRegistro: z.string(),
  unidad: z.string(),
  latitudDecimal: z.number(),
  longitudDecimal: z.number(),
});

export type HerramientaEnListado = z.infer<typeof herramientaEnListado>;

// ── Normatividad A.I. ─────────────────────────────────────────────────────

export const normatividadEnListado = z.object({
  id: z.number().int(),
  tipo: z.string(),
  numero: z.string(),
  anio: z.number().int(),
  titulo: z.string(),
  expedidaPor: z.string().nullable(),
  fechaExpedicion: z.string(),
  tieneArchivo: z.boolean(),
});

export type NormatividadEnListado = z.infer<typeof normatividadEnListado>;

// ── Catálogos ─────────────────────────────────────────────────────────────

/**
 * Una opción de un catálogo cerrado de `ref`.
 *
 * Existe porque los dominios cerrados viven en tablas de `ref` y NUNCA en
 * VARCHAR libre: la interfaz tiene que leer las opciones del servidor, no
 * llevar su propia copia. Una copia en el cliente se desactualiza sin avisar y
 * empieza a ofrecer valores que la base rechaza.
 */
export const opcionCatalogo = z.object({
  id: z.number().int(),
  codigo: z.string(),
  nombre: z.string(),
});

export type OpcionCatalogo = z.infer<typeof opcionCatalogo>;

/** Los catálogos que la interfaz puede pedir, por nombre. */
export const CATALOGOS_EXPUESTOS = [
  'tipo_documento_identidad',
  'grado',
  'escalafon',
  'tipo_entidad',
  'tipo_herramienta_aid',
  'tipo_normatividad',
  'departamento',
  'municipio',
  'medio_utilizado',
  'medio_difusion',
  'servicio_prestado',
  'grupo_poblacional',
  'tipo_bien_donado',
  'tipo_recurso',
  'tipo_operacion',
  'tipo_asistencia',
  'tipo_jornada',
  'coami',
] as const;

export type CatalogoExpuesto = (typeof CATALOGOS_EXPUESTOS)[number];

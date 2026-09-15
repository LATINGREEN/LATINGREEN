import type { CatalogoExpuesto } from '@paid/schema';

/**
 * Qué control corresponde a cada campo de las diez pestañas de datos.
 *
 * ⚠️ Sin este mapa los paneles pedían el identificador numérico en un campo de
 * texto: «Id tipo operacion: ____». Es imposible de diligenciar —el
 * identificador no aparece en ninguna pantalla— y un número inventado llega al
 * servidor como violación de clave foránea. Lo encontró la prueba de la
 * Puerta 4, que tecleó un 12 y recibió un error de base de datos.
 *
 * Los dominios cerrados viven en catálogos de `ref` (anexo: «nunca VARCHAR
 * libre»), así que cada `id*` tiene un catálogo detrás, y el desplegable lo
 * lee del servidor. Las dos excepciones apuntan al maestro `ai.entidad`, que
 * no es un catálogo de `ref` sino uno de los tres maestros de R8.
 *
 * Qué pasa cuando Q4 se responda: los campos de cinco pestañas cambiarán. El
 * panel los deriva del esquema Zod, así que aparecerán solos; lo único que hay
 * que añadir aquí es su catálogo. Un campo `id*` que no esté en este mapa se
 * dibuja como número y se ve venir.
 */
export const CATALOGO_DE_CAMPO: Readonly<Record<string, CatalogoExpuesto>> = {
  idTipoOperacion: 'tipo_operacion',
  idServicioPrestado: 'servicio_prestado',
  idGrupoPoblacional: 'grupo_poblacional',
  idMedioDifusion: 'medio_difusion',
  idMedioUtilizado: 'medio_utilizado',
  idTipoRecurso: 'tipo_recurso',
  idTipoBienDonado: 'tipo_bien_donado',
};

/** Los campos que apuntan al maestro de Entidades A.I., no a un catálogo. */
export const CAMPOS_DE_ENTIDAD: readonly string[] = ['idEntidad', 'idEntidadDonante'];

/**
 * `idTipoOperacion` → «Tipo de operación».
 *
 * Quita el prefijo `id`, parte el camelCase y pone la preposición. No es
 * cosmética: el rótulo es lo único que le dice a la persona qué se le pide, y
 * «Id tipo operacion» no se lo dice.
 */
export function humanizarCampo(campo: string): string {
  const sinId = campo.startsWith('id') && campo.length > 2 ? campo.slice(2) : campo;
  const palabras = sinId.replace(/([A-Z])/gu, ' $1').trim().toLowerCase();
  const conTilde = ACENTOS[palabras] ?? palabras;
  return conTilde.charAt(0).toUpperCase() + conTilde.slice(1);
}

/**
 * Los nombres de campo van en snake_case sin tildes ni eñes (A.6), pero el
 * rótulo que lee una persona sí las lleva: es español de Colombia, no un
 * identificador.
 */
const ACENTOS: Readonly<Record<string, string>> = {
  'tipo operacion': 'tipo de operación',
  'servicio prestado': 'servicio prestado',
  'grupo poblacional': 'grupo poblacional',
  'medio difusion': 'medio de difusión',
  'medio utilizado': 'medio utilizado',
  'tipo recurso': 'tipo de recurso',
  'tipo bien donado': 'tipo de bien donado',
  'entidad donante': 'entidad donante',
  observacion: 'observaciones',
  descripcion: 'descripción',
  'unidad medida': 'unidad de medida',
  'valor estimado': 'valor estimado',
  'cantidad personas': 'cantidad de personas',
  texto: 'texto del resumen',
};

/* ─────────────────────────────────────────────────────────────────────────────
   De qué tipo es cada campo, y en qué forma viaja
   ───────────────────────────────────────────────────────────────────────────── */

/** Un esquema Zod de un campo, en lo que aquí hace falta. */
export interface EsquemaDeCampo {
  readonly safeParse: (valor: unknown) => { readonly success: boolean };
}

export type ClaseCampo = 'entero' | 'decimal' | 'texto';

/**
 * Clasifica un campo PREGUNTÁNDOLE A SU ESQUEMA, no adivinando por el nombre.
 *
 * ⚠️ Adivinar por el nombre ya falló. `cantidad` es un entero en «Servicios
 * Prestados» (`cantidadEntera`) y un decimal en «Recursos Utilizados»
 * (`decimalDigitado`): el mismo nombre, dos tipos. La pantalla pedía los dos
 * igual, con la ayuda «el separador decimal es el punto» incluso donde un
 * decimal se rechaza, y enviaba `12.5` a un campo entero. Lo cazó la prueba de
 * la Puerta 4.
 *
 * Preguntándole al esquema, esto sigue siendo correcto cuando Q4 se responda y
 * los tipos cambien.
 */
export function clasificarCampo(esquema: EsquemaDeCampo | undefined): ClaseCampo {
  if (esquema === undefined) return 'texto';

  /*
   * ⚠️ Lo primero es descartar que sea un campo de TEXTO, y el orden importa.
   *
   * Una primera versión probaba `safeParse('7.5')` para detectar decimales, y
   * marcó como decimal el campo «Observaciones»: un `z.string()` acepta
   * «7.5», claro. La pantalla le puso debajo «Admite decimales, el separador
   * es el punto» a una casilla de texto libre. Una ayuda que miente es peor
   * que ninguna: dirige a escribir lo que no se pide.
   *
   * Un esquema de texto acepta cualquier cadena; uno numérico no. Así que si
   * admite algo que no es un número, es texto, y ahí se acaba.
   */
  if (esquema.safeParse('no es un numero').success) return 'texto';

  const aceptaDecimal = esquema.safeParse(7.5).success || esquema.safeParse('7.5').success;
  if (aceptaDecimal) return 'decimal';
  const aceptaEntero = esquema.safeParse(7).success || esquema.safeParse('7').success;
  return aceptaEntero ? 'entero' : 'texto';
}

/**
 * Convierte lo digitado a la forma que el esquema del campo acepta.
 *
 * Se prueba la cadena primero y el número después, y gana la que el esquema
 * admita. Es deliberado que lo decida el esquema y no una regla escrita aquí:
 * `decimalDigitado` quiere la CADENA —porque valida que el separador sea el
 * punto y no la coma, y un `Number()` previo se saltaría esa validación— y
 * `cantidadEntera` quiere el NÚMERO. Las dos cosas a la vez no se pueden
 * cablear sin repetir el conocimiento que ya está en el esquema.
 *
 * Si ninguna forma encaja se devuelve la cadena, para que el error que vea la
 * persona sea el del esquema y no un `NaN` silencioso.
 */
export function aValorDeEnvio(esquema: EsquemaDeCampo | undefined, crudo: string): unknown {
  if (esquema === undefined) return crudo;
  if (esquema.safeParse(crudo).success) return crudo;
  const numero = Number(crudo);
  if (!Number.isNaN(numero) && esquema.safeParse(numero).success) return numero;
  return crudo;
}

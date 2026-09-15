import { z } from 'zod';

/**
 * Primitivos compartidos por el formulario (apps/web) y el controlador
 * (apps/api). Un solo esquema por concepto: si cliente y servidor divergen,
 * hay un error de diseno (PROMPT.md A.6).
 */

/** Zona horaria de presentacion. El almacenamiento es siempre UTC (A.2.5). */
export const ZONA_HORARIA_PRESENTACION = 'America/Bogota' as const;

/**
 * Separador decimal: **punto**. El manual lo exige expresamente en los
 * formularios (A.2.4). Una coma se rechaza en lugar de «interpretarse»:
 * interpretar `1,234` es ambiguo (mil doscientos treinta y cuatro, o uno con
 * doscientos treinta y cuatro) y de ahi salen consolidados que no cuadran.
 */
export const SEPARADOR_DECIMAL = '.' as const;

const RE_DECIMAL_CON_PUNTO = /^-?\d+(\.\d+)?$/;

/** Numero digitado por el usuario: solo punto decimal, nunca coma. */
export const decimalDigitado = z
  .string()
  .trim()
  .refine((v) => !v.includes(','), {
    message: 'El separador decimal es el punto (.), no la coma. Ejemplo: 1234.56',
  })
  .refine((v) => RE_DECIMAL_CON_PUNTO.test(v), {
    message: 'Numero invalido. Use digitos y, opcionalmente, un punto decimal.',
  })
  .transform((v) => Number(v));

/** Cantidad entera no negativa (beneficiarios, unidades donadas, raciones...). */
export const cantidadEntera = z
  .number()
  .int({ message: 'Debe ser un numero entero.' })
  .nonnegative({ message: 'No puede ser negativo.' });

const RE_FECHA_DDMMAAAA = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** Verifica que dd/mm/aaaa exista de verdad en el calendario. */
function esFechaReal(dia: number, mes: number, anio: number): boolean {
  if (mes < 1 || mes > 12 || dia < 1) return false;
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
  );
}

/**
 * Fecha sin hora, digitada como `dd/mm/aaaa` (A.2.4), normalizada a
 * `aaaa-mm-dd` para viajar a una columna `DATE`.
 *
 * Es `DATE` y no `TIMESTAMP` a proposito (A.2.5): un `TIMESTAMP` invita a un
 * componente horario espurio que desplaza el dia en los informes.
 */
export const fechaDdMmAaaa = z
  .string()
  .trim()
  .refine((v) => RE_FECHA_DDMMAAAA.test(v), {
    message: 'La fecha se digita como dd/mm/aaaa. Ejemplo: 05/03/2026',
  })
  .refine(
    (v) => {
      const m = RE_FECHA_DDMMAAAA.exec(v);
      if (m === null) return false;
      return esFechaReal(Number(m[1]), Number(m[2]), Number(m[3]));
    },
    { message: 'Esa fecha no existe en el calendario.' },
  )
  .transform((v) => {
    const m = RE_FECHA_DDMMAAAA.exec(v);
    // El refine anterior garantiza el match; esto satisface al verificador.
    if (m === null) throw new Error('fecha invalida');
    return `${m[3]}-${m[2]}-${m[1]}`;
  });

/** Formatea `aaaa-mm-dd` (o un Date) como `dd/mm/aaaa` para la interfaz. */
export function formatearFechaDdMmAaaa(valor: string | Date): string {
  const iso = valor instanceof Date ? valor.toISOString().slice(0, 10) : valor.slice(0, 10);
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}

/**
 * Normalizacion de texto para comparacion y deduplicacion: sin tildes, sin
 * dobles espacios, en mayusculas. Es la base del indice GIN con `pg_trgm`
 * sobre el nombre de entidad (Fase 1, punto 5) y de U3 (Fase 6).
 *
 * TODO(Fase 1): la funcion SQL equivalente debe producir **exactamente** este
 * resultado. Si divergen, el indice trigram y la comparacion en cliente
 * discrepan y aparecen duplicados que la interfaz dijo que no existian.
 */
export function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** Identificador de fila. `BIGINT` en base; `string` en el borde HTTP. */
export const idRegistro = z.coerce.number().int().positive();

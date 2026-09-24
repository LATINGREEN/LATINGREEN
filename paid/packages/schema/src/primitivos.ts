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

/**
 * La fecha de HOY en Colombia, como `aaaa-mm-dd`.
 *
 * No `new Date().toISOString().slice(0, 10)`: eso es la fecha en UTC, que
 * desde las 19:00 de Bogotá ya es «mañana», y una fecha de hoy digitada a las
 * ocho de la noche se rechazaría como futura.
 */
export function hoyEnBogota(): string {
  // `en-CA` da exactamente `aaaa-mm-dd`.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA_PRESENTACION,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

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

/**
 * La MISMA fecha ya normalizada a `aaaa-mm-dd`.
 *
 * ⚠️ Existe por una razon de diseno, no por comodidad: `fechaDdMmAaaa`
 * **transforma**, y este esquema se ejecuta DOS VECES sobre el mismo dato —una
 * en el formulario y otra en el controlador (A.6: un solo esquema para cliente
 * y servidor). Si la transformacion no admitiera su propia salida, la segunda
 * pasada rechazaria lo que la primera acepto, y el formulario no podria
 * guardar nunca.
 *
 * Paso: lo detecto la Puerta 4. El formulario validaba, obtenia `2026-03-02` y
 * lo enviaba; el controlador volvia a validar, exigia `dd/mm/aaaa` y respondia
 * «No se pudo registrar la jornada». Ver docs/DECISIONES.md, D-25.
 *
 * Aceptar la forma ISO no debilita A.2.4. Lo que A.2.4 evita es que una fecha
 * DIGITADA se lea al reves —`03/05/2026` es 3 de mayo o 5 de marzo segun el
 * pais—, y `2026-03-02` no tiene esa ambiguedad: el ano va delante y el orden
 * es el de la norma. La interfaz sigue pidiendo y mostrando `dd/mm/aaaa`.
 */
const RE_FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

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
  .refine((v) => RE_FECHA_DDMMAAAA.test(v) || RE_FECHA_ISO.test(v), {
    message: 'La fecha se digita como dd/mm/aaaa. Ejemplo: 05/03/2026',
  })
  .refine(
    (v) => {
      const partes = descomponerFecha(v);
      if (partes === null) return false;
      return esFechaReal(partes.dia, partes.mes, partes.anio);
    },
    { message: 'Esa fecha no existe en el calendario.' },
  )
  // Idempotente: aplicar este esquema a su propia salida devuelve lo mismo.
  .transform((v) => {
    const partes = descomponerFecha(v);
    // Los refine anteriores lo garantizan; esto satisface al verificador.
    if (partes === null) throw new Error('fecha invalida');
    const dosDigitos = (n: number): string => String(n).padStart(2, '0');
    return `${String(partes.anio)}-${dosDigitos(partes.mes)}-${dosDigitos(partes.dia)}`;
  });

/** Descompone `dd/mm/aaaa` o `aaaa-mm-dd`. `null` si no es ninguna. */
function descomponerFecha(
  valor: string,
): { readonly dia: number; readonly mes: number; readonly anio: number } | null {
  const digitada = RE_FECHA_DDMMAAAA.exec(valor);
  if (digitada !== null) {
    return {
      dia: Number(digitada[1]),
      mes: Number(digitada[2]),
      anio: Number(digitada[3]),
    };
  }
  const iso = RE_FECHA_ISO.exec(valor);
  if (iso !== null) {
    return { dia: Number(iso[3]), mes: Number(iso[2]), anio: Number(iso[1]) };
  }
  return null;
}

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

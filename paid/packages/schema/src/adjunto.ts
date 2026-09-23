import { z } from 'zod';

/**
 * R11 — Cuota de 10 MB **AGREGADA** por actividad.
 * R12 — Extensiones permitidas por categoria.
 *
 * La cuota no es por archivo: es la suma de **todos** los archivos vigentes de
 * una misma actividad. El anti-patron P5 es exactamente el error de escribir
 * `CHECK (peso_bytes <= 10485760)`, que deja pasar cuarenta archivos de 9 MB.
 * La regla se impone con un disparador `BEFORE INSERT` que suma los bytes
 * vigentes (Fase 1), y la interfaz muestra el consumo acumulado **antes** de
 * que el usuario intente subir (Fase 3).
 */

export const CUOTA_BYTES_POR_ACTIVIDAD = 10 * 1024 * 1024; // 10485760

export const CATEGORIAS_ADJUNTO = ['IMAGEN', 'DOCUMENTO', 'AUDIO', 'VIDEO'] as const;
export type CategoriaAdjunto = (typeof CATEGORIAS_ADJUNTO)[number];

/** R12, tal cual la tabla del manual. */
export const EXTENSIONES_POR_CATEGORIA: Readonly<
  Record<CategoriaAdjunto, readonly string[]>
> = {
  IMAGEN: ['jpg', 'png', 'gif', 'jpeg'],
  DOCUMENTO: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
  AUDIO: ['mp3', 'wma'],
  VIDEO: ['mp4', 'wmv', 'avi'],
} as const;

/**
 * MIME esperado por extension. Se valida contra el **contenido real** (numero
 * magico / MIME), no contra la extension declarada (R12): renombrar
 * `programa.exe` a `foto.jpg` no debe bastar.
 *
 * Varias extensiones admiten mas de un MIME real (un .doc antiguo y un .docx
 * mal nombrado, por ejemplo), de ahi la lista.
 */
export const MIME_ESPERADO_POR_EXTENSION: Readonly<Record<string, readonly string[]>> = {
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  gif: ['image/gif'],
  pdf: ['application/pdf'],
  doc: ['application/msword', 'application/x-cfb'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls: ['application/vnd.ms-excel', 'application/x-cfb'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ppt: ['application/vnd.ms-powerpoint', 'application/x-cfb'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  mp3: ['audio/mpeg'],
  wma: ['audio/x-ms-wma', 'video/x-ms-asf'],
  mp4: ['video/mp4'],
  wmv: ['video/x-ms-wmv', 'video/x-ms-asf'],
  avi: ['video/x-msvideo'],
} as const;

const TODAS_LAS_EXTENSIONES: readonly string[] = Object.values(
  EXTENSIONES_POR_CATEGORIA,
).flat();

export function extensionDe(nombreArchivo: string): string {
  const punto = nombreArchivo.lastIndexOf('.');
  if (punto < 0 || punto === nombreArchivo.length - 1) return '';
  return nombreArchivo.slice(punto + 1).toLowerCase();
}

export function categoriaDeExtension(extension: string): CategoriaAdjunto | null {
  const ext = extension.toLowerCase();
  for (const categoria of CATEGORIAS_ADJUNTO) {
    if (EXTENSIONES_POR_CATEGORIA[categoria].includes(ext)) return categoria;
  }
  return null;
}

export function extensionPermitida(extension: string): boolean {
  return TODAS_LAS_EXTENSIONES.includes(extension.toLowerCase());
}

/** El MIME real coincide con lo que la extension promete (R12). */
export function mimeCoincideConExtension(extension: string, mimeReal: string): boolean {
  const esperados = MIME_ESPERADO_POR_EXTENSION[extension.toLowerCase()];
  if (esperados === undefined) return false;
  return esperados.includes(mimeReal.toLowerCase());
}

/**
 * Fase documental del soporte (1, 2, 3). El manual la usa para ordenar los
 * soportes de cada tramo de avance.
 *
 * TODO(JACID): confirmar el significado exacto de cada fase y si alguna es
 * obligatoria por tramo de la escala de R10. Ver PREGUNTAS-JACID.md, Q7.
 */
export const FASES_DOCUMENTALES = [1, 2, 3] as const;

/**
 * Q7, RESPONDIDA por el Manual del Usuario PAID (lámina 22): qué soportes van
 * en cada fase documental de una JORNADA DE APOYO.
 *
 * Es propio de las jornadas. El mismo manual define otros soportes para las
 * asistencias humanitarias (directa o indirecta, lámina 27) y los asocia a los
 * tramos de avance en los proyectos (lámina 42): cuando esos módulos existan,
 * llevarán su propia tabla y no esta.
 */
export const SOPORTES_POR_FASE_JORNADA: Readonly<Record<(typeof FASES_DOCUMENTALES)[number], string>> = {
  1: 'Acta de reunión y planilla de asistencia de la comunidad (diagnóstico).',
  2: 'Oficios a las entidades participantes y acta de reunión con las entidades.',
  3:
    'Verificación ReTHUS o tarjeta profesional del personal de salud, evidencias de ' +
    'donaciones (facturas, informe o actas de entrega), formatos SVE de caracterización ' +
    'y de revista, encuesta de satisfacción, informe final JAD, material fotográfico, ' +
    'videos si aplica y formato de impacto COGFM.',
};
export type FaseDocumental = (typeof FASES_DOCUMENTALES)[number];

export const adjuntoPropuesto = z.object({
  nombreArchivo: z.string().trim().min(1),
  pesoBytes: z
    .number()
    .int()
    .positive({ message: 'El archivo esta vacio.' })
    .max(CUOTA_BYTES_POR_ACTIVIDAD, {
      message: 'Un solo archivo ya agota la cuota de 10 MB de la actividad.',
    }),
  faseDocumental: z
    .number()
    .int()
    .refine((v): v is FaseDocumental => (FASES_DOCUMENTALES as readonly number[]).includes(v), {
      message: 'La fase documental es 1, 2 o 3.',
    }),
});

export type AdjuntoPropuesto = z.infer<typeof adjuntoPropuesto>;

export interface EstadoCuota {
  readonly bytesUsados: number;
  readonly bytesDisponibles: number;
  readonly porcentajeUsado: number;
}

/**
 * Consumo acumulado de una actividad, para mostrarlo **antes** de que el
 * usuario elija un archivo (R11). Que la interfaz avise no exime al
 * disparador: la regla vive en la base.
 */
export function calcularCuota(bytesVigentes: readonly number[]): EstadoCuota {
  const bytesUsados = bytesVigentes.reduce((suma, b) => suma + b, 0);
  const bytesDisponibles = Math.max(0, CUOTA_BYTES_POR_ACTIVIDAD - bytesUsados);
  return {
    bytesUsados,
    bytesDisponibles,
    porcentajeUsado: Math.round((bytesUsados / CUOTA_BYTES_POR_ACTIVIDAD) * 1000) / 10,
  };
}

/** ¿Cabe un archivo mas de `pesoBytes` en esta actividad? (R11) */
export function cabeEnLaCuota(
  bytesVigentes: readonly number[],
  pesoBytes: number,
): boolean {
  return calcularCuota(bytesVigentes).bytesDisponibles >= pesoBytes;
}

export function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

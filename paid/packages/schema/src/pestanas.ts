/**
 * R19 — Las once pestanas son obligatorias.
 *
 * La obligatoriedad **no** se expresa con `NOT NULL`: son tablas hijas que
 * pueden quedar vacias. Se calcula en `ai.actividad.registro_completo`, y los
 * consolidados del RAO filtran por el. El listado senala visualmente los
 * registros incompletos.
 */

export const PESTANAS_ACTIVIDAD = [
  'TIPO_OPERACION',
  'ARCHIVOS_ADJUNTOS',
  'ENTIDADES_SERVICIOS',
  'SERVICIOS_PRESTADOS',
  'POBLACION_BENEFICIADA',
  'ENTIDADES_APOYADAS',
  'MEDIOS_DIFUSION',
  'MEDIOS_UTILIZADOS',
  'RECURSOS_UTILIZADOS',
  'BIENES_DONADOS',
  'RESUMEN',
] as const;

export type PestanaActividad = (typeof PESTANAS_ACTIVIDAD)[number];

/** Once. Si esta cuenta cambia, alguien perdio una pestana por el camino. */
export const CANTIDAD_PESTANAS = 11 as const;

export const ETIQUETA_PESTANA: Readonly<Record<PestanaActividad, string>> = {
  TIPO_OPERACION: 'Tipo Operación',
  ARCHIVOS_ADJUNTOS: 'Archivos Adjuntos',
  ENTIDADES_SERVICIOS: 'Entidades Servicios',
  SERVICIOS_PRESTADOS: 'Servicios Prestados',
  POBLACION_BENEFICIADA: 'Población Beneficiada',
  ENTIDADES_APOYADAS: 'Entidades Apoyadas',
  MEDIOS_DIFUSION: 'Medios Difusión',
  MEDIOS_UTILIZADOS: 'Medios Utilizados',
  RECURSOS_UTILIZADOS: 'Recursos Utilizados',
  BIENES_DONADOS: 'Bienes Donados',
  RESUMEN: 'Resumen',
} as const;

/**
 * `POBLACION_BENEFICIADA` es la pestana que el diseno auditado documento y no
 * implemento (anti-patron P2), y es justo la cifra que alimenta el RAO. Se
 * nombra aparte para que el test de inventario de la Fase 1 la cite por su
 * nombre y no se vuelva a perder.
 */
export const PESTANA_QUE_ALIMENTA_EL_RAO = 'POBLACION_BENEFICIADA' as const;

export interface EstadoPestanas {
  readonly completas: readonly PestanaActividad[];
  readonly faltantes: readonly PestanaActividad[];
  readonly registroCompleto: boolean;
}

/**
 * Espejo en cliente de `ai.actividad.registro_completo`, para pintar el aviso
 * en el formulario. **La fuente de verdad sigue siendo la base**: esto es
 * presentacion, no validacion.
 *
 * TODO(JACID) Q4: los formularios reales de Tipo Operacion, Entidades
 * Servicios, Servicios Prestados, Poblacion Beneficiada y Entidades Apoyadas
 * no se conocen. Mientras no se conozcan, «tiene datos» significa «la tabla
 * hija tiene al menos una fila», que es lo que PROMPT.md R19 permite afirmar.
 */
export function evaluarPestanas(
  pestanasConDatos: readonly PestanaActividad[],
): EstadoPestanas {
  const conDatos = new Set(pestanasConDatos);
  const completas = PESTANAS_ACTIVIDAD.filter((p) => conDatos.has(p));
  const faltantes = PESTANAS_ACTIVIDAD.filter((p) => !conDatos.has(p));
  return {
    completas,
    faltantes,
    registroCompleto: faltantes.length === 0,
  };
}

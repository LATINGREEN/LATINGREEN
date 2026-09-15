import { PESTANAS_ACTIVIDAD, ETIQUETA_PESTANA } from '@paid/schema';
import type { PestanaActividad } from '@paid/schema';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LA ROSA DE PESTAÑAS — el elemento firma de esta interfaz.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Once segmentos en anillo, uno por cada pestaña obligatoria de R19, que se
 * encienden a medida que reciben datos. En el centro, el conteo.
 *
 * No es decoración náutica. Es la respuesta a dos frases de PROMPT.md:
 *
 *   R19 — «El listado señala visualmente los registros incompletos.»
 *   Y la advertencia final: «el defecto característico de este sistema no es
 *   que falle: es que parezca funcionar mientras acumula datos que no
 *   cuadran.»
 *
 * Un registro incompleto no lanza ningún error. Sale del listado, entra en el
 * consolidado del RAO filtrado por `registro_completo`, y meses después las
 * cifras no cuadran. La rosa hace que «faltan tres pestañas» se vea de un
 * golpe, en la lista y en el formulario, sin abrir nada.
 *
 * ── Accesibilidad ───────────────────────────────────────────────────────
 *
 * El color NUNCA lleva la información solo. La rosa tiene:
 *   - `role="img"` con un `aria-label` que dice el estado en palabras;
 *   - el número en el centro, legible;
 *   - y en tamaño grande, cada segmento con su rótulo y su marca.
 * Quien no distingue verde de rojo lee el mismo dato.
 */

export interface RosaPestanasProps {
  /** Las pestañas que YA tienen datos. */
  readonly completas: readonly PestanaActividad[];
  readonly tamano?: 'pequena' | 'grande';
  /** En tamaño grande, permite saltar a una pestaña. */
  readonly onElegir?: (pestana: PestanaActividad) => void;
  readonly pestanaActiva?: PestanaActividad;
}

const TOTAL = PESTANAS_ACTIVIDAD.length; // once

export function RosaPestanas({
  completas,
  tamano = 'pequena',
  onElegir,
  pestanaActiva,
}: RosaPestanasProps): JSX.Element {
  const hechas = new Set(completas);
  const cuantas = PESTANAS_ACTIVIDAD.filter((p) => hechas.has(p)).length;
  const faltan = TOTAL - cuantas;
  const completo = faltan === 0;

  const lado = tamano === 'grande' ? 208 : 44;
  const centro = lado / 2;
  const grosor = tamano === 'grande' ? 16 : 5;
  const radio = centro - grosor / 2 - (tamano === 'grande' ? 14 : 2);

  // Un hueco entre segmentos, para que se lean como once y no como un aro.
  const separacion = tamano === 'grande' ? 3.2 : 4.5;
  const arco = 360 / TOTAL;

  const descripcion = completo
    ? `Registro completo: las ${TOTAL} pestañas tienen datos.`
    : `Registro incompleto: ${cuantas} de ${TOTAL} pestañas con datos. Faltan ${faltan}: ` +
      PESTANAS_ACTIVIDAD.filter((p) => !hechas.has(p))
        .map((p) => ETIQUETA_PESTANA[p])
        .join(', ') +
      '.';

  function segmento(indice: number): string {
    // Se empieza arriba (norte) y se avanza en el sentido de las agujas.
    const desde = indice * arco - 90 + separacion / 2;
    const hasta = (indice + 1) * arco - 90 - separacion / 2;
    const rad = (g: number) => (g * Math.PI) / 180;
    const x1 = centro + radio * Math.cos(rad(desde));
    const y1 = centro + radio * Math.sin(rad(desde));
    const x2 = centro + radio * Math.cos(rad(hasta));
    const y2 = centro + radio * Math.sin(rad(hasta));
    return `M ${x1} ${y1} A ${radio} ${radio} 0 0 1 ${x2} ${y2}`;
  }

  return (
    <div className={`rosa rosa-${tamano}`}>
      <svg
        viewBox={`0 0 ${lado} ${lado}`}
        width={lado}
        height={lado}
        role="img"
        aria-label={descripcion}
        className="rosa-svg"
      >
        {/* Los cuatro rumbos cardinales, como en una rosa de los vientos.
            Solo en tamaño grande: en pequeño serían ruido. */}
        {tamano === 'grande' && (
          <g className="rosa-rumbos" aria-hidden="true">
            {[0, 90, 180, 270].map((g) => {
              const rad = ((g - 90) * Math.PI) / 180;
              const r1 = radio + grosor / 2 + 4;
              const r2 = radio + grosor / 2 + 9;
              return (
                <line
                  key={g}
                  x1={centro + r1 * Math.cos(rad)}
                  y1={centro + r1 * Math.sin(rad)}
                  x2={centro + r2 * Math.cos(rad)}
                  y2={centro + r2 * Math.sin(rad)}
                />
              );
            })}
          </g>
        )}

        {PESTANAS_ACTIVIDAD.map((pestana, indice) => {
          const lista = hechas.has(pestana);
          const activa = pestanaActiva === pestana;
          const clases = [
            'rosa-seg',
            lista ? 'rosa-seg-lista' : 'rosa-seg-falta',
            activa ? 'rosa-seg-activa' : '',
          ]
            .filter(Boolean)
            .join(' ');
          const camino = (
            <path
              d={segmento(indice)}
              className={clases}
              strokeWidth={grosor}
              style={{ animationDelay: `${indice * 38}ms` }}
            />
          );
          if (onElegir === undefined || tamano !== 'grande') {
            return <g key={pestana} aria-hidden="true">{camino}</g>;
          }
          return (
            <g
              key={pestana}
              role="button"
              tabIndex={0}
              aria-label={`${ETIQUETA_PESTANA[pestana]}: ${lista ? 'con datos' : 'sin datos'}`}
              className="rosa-seg-tocable"
              onClick={() => onElegir(pestana)}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter' || evento.key === ' ') {
                  evento.preventDefault();
                  onElegir(pestana);
                }
              }}
            >
              {camino}
            </g>
          );
        })}
      </svg>

      <div className="rosa-centro" aria-hidden="true">
        <span className="rosa-cuenta datos">
          {cuantas}
          <span className="rosa-de">/{TOTAL}</span>
        </span>
        {tamano === 'grande' && (
          <span className={`rosa-leyenda ${completo ? 'es-completo' : 'es-incompleto'}`}>
            {completo ? 'Completo' : `Faltan ${faltan}`}
          </span>
        )}
      </div>
    </div>
  );
}

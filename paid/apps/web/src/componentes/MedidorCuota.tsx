import { CUOTA_BYTES_POR_ACTIVIDAD, formatearBytes } from '@paid/schema';
import type { EstadoCuota } from '@paid/schema';

/**
 * R11 — La cuota de 10 MB es **AGREGADA** por actividad, no por archivo.
 *
 * «La interfaz muestra el consumo acumulado ANTES de que el usuario intente
 * subir.» Eso es todo el propósito de este medidor, y el orden importa: si el
 * consumo apareciera solo después de un rechazo, el usuario habría perdido el
 * tiempo de una subida.
 *
 * El texto dice explícitamente «entre todos los archivos». La confusión
 * natural es creer que son 10 MB por archivo —es lo que hacen casi todos los
 * sistemas— y esa confusión termina en un rechazo que parece un error.
 */
export function MedidorCuota({ cuota }: { readonly cuota: EstadoCuota }): JSX.Element {
  const proporcion = Math.min(1, cuota.bytesUsados / CUOTA_BYTES_POR_ACTIVIDAD);
  const estado = proporcion >= 1 ? 'lleno' : proporcion > 0.8 ? 'apretado' : 'holgado';

  return (
    <div className={`cuota cuota-${estado}`}>
      <div className="fila-sep">
        <span className="rotulo" id="cuota-rotulo">Cuota de soportes</span>
        <span className="datos cuota-cifra">
          {formatearBytes(cuota.bytesUsados)} de{' '}
          {formatearBytes(CUOTA_BYTES_POR_ACTIVIDAD)}
        </span>
      </div>
      <div
        className="cuota-pista"
        role="progressbar"
        /* Una barra de progreso sin nombre se anuncia como «barra de progreso,
           40 %» — ¿de qué? El nombre lo da el rótulo visible de encima. Lo
           encontró la revisión con axe al cubrir la pestaña de adjuntos. */
        aria-labelledby="cuota-rotulo"
        aria-valuemin={0}
        aria-valuemax={CUOTA_BYTES_POR_ACTIVIDAD}
        aria-valuenow={cuota.bytesUsados}
        aria-valuetext={`${formatearBytes(cuota.bytesUsados)} usados de ${formatearBytes(
          CUOTA_BYTES_POR_ACTIVIDAD,
        )} disponibles entre todos los archivos de esta actividad.`}
      >
        <span className="cuota-relleno" style={{ transform: `scaleX(${proporcion})` }} />
      </div>
      <p className="ayuda">
        Los 10 MB son <strong>entre todos los archivos</strong> de esta jornada, no por
        archivo. Quedan {formatearBytes(cuota.bytesDisponibles)}.
      </p>
    </div>
  );
}

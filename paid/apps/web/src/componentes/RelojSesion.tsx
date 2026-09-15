import { useSesion } from '../api/sesion';
import { Reloj } from './Iconos';

/**
 * R1 hecho instrumento.
 *
 * «Diez minutos de inactividad cierran la sesión. Expiración deslizante: cada
 * petición autenticada la desplaza. Se evalúa en el servidor.»
 *
 * En casi todos los sistemas esa regla es invisible hasta que muerde: el
 * usuario pierde lo que estaba escribiendo y no entiende por qué. Aquí el
 * tiempo restante está a la vista, como una sonda, y el aviso llega a los 8
 * minutos con un botón para seguir trabajando (Fase 4, punto 1).
 *
 * La cuenta se calcula de `expiraEnUtc`, que viene del SERVIDOR. El cliente no
 * decide cuándo vence: solo lo muestra.
 */
export function RelojSesion(): JSX.Element | null {
  const { sesion, segundosRestantes, avisarExpiracion, renovar } = useSesion();
  if (sesion === null) return null;

  const minutos = Math.floor(segundosRestantes / 60);
  const segundos = segundosRestantes % 60;
  const proporcion = Math.min(1, segundosRestantes / 600);

  const estado = avisarExpiracion ? 'urge' : proporcion > 0.5 ? 'bien' : 'medio';

  return (
    <div className={`reloj reloj-${estado}`}>
      <Reloj tamano={16} />
      <span className="reloj-cifra datos" aria-hidden="true">
        {minutos}:{String(segundos).padStart(2, '0')}
      </span>
      {/* El texto para lector de pantalla se redondea a minutos: no tiene
          sentido anunciar «4 minutos 37 segundos» cada segundo. */}
      <span className="solo-lectores">
        La sesión se cierra por inactividad en aproximadamente {minutos + 1} minutos.
      </span>
      <span className="reloj-barra" aria-hidden="true">
        <span className="reloj-relleno" style={{ transform: `scaleX(${proporcion})` }} />
      </span>
      {avisarExpiracion && (
        <button
          type="button"
          className="boton boton-primario reloj-renovar"
          onClick={() => void renovar()}
        >
          Seguir trabajando
        </button>
      )}
    </div>
  );
}

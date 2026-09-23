import { LETRAS, useAccesibilidad } from '../api/accesibilidad';
import { Contraste as IconoContraste, Telefono } from './Iconos';

/**
 * La barra de pantalla del manual: contraste, reducir letra, aumentar letra y
 * contáctenos, flotando en el borde derecho (lámina 12 del Manual del Usuario).
 *
 * Tres decisiones de accesibilidad sobre ese diseño:
 *
 * 1. **Cada botón dice su estado.** El de contraste es un conmutador con
 *    `aria-pressed`; los de letra dicen en su nombre accesible el tamaño que
 *    resultará. Un icono solo, sin eso, obliga a pulsar para averiguar.
 * 2. **A− y A+ se deshabilitan en los extremos**, en lugar de no hacer nada al
 *    pulsarlos: un botón que no responde parece roto.
 * 3. **Los objetivos miden 44 px.** En el manual son más pequeños; WCAG 2.1 AA
 *    pide 24 y 44 es lo que se puede tocar en una tableta.
 *
 * Está en todas las pantallas, también en el ingreso: quien necesita letra
 * grande la necesita antes de poder leer el formulario de ingreso.
 */
export function ControlesAccesibilidad(): JSX.Element {
  const { contraste, letra, fijarContraste, fijarLetra } = useAccesibilidad();
  const indice = LETRAS.indexOf(letra);
  const altoContraste = contraste === 'alto';

  const irAContacto = (): void => {
    const contacto = document.getElementById('contacto');
    if (contacto !== null) {
      contacto.scrollIntoView({ behavior: 'smooth', block: 'center' });
      contacto.focus({ preventScroll: true });
    }
  };

  return (
    <div className="barra-pantalla" role="toolbar" aria-label="Opciones de pantalla">
      <button
        type="button"
        className="barra-pantalla-boton"
        aria-pressed={altoContraste}
        title={altoContraste ? 'Desactivar alto contraste' : 'Activar alto contraste'}
        onClick={() => fijarContraste(altoContraste ? 'institucional' : 'alto')}
      >
        <IconoContraste tamano={18} />
        <span className="solo-lectores">Alto contraste</span>
      </button>
      <button
        type="button"
        className="barra-pantalla-boton"
        disabled={indice <= 0}
        title="Reducir letra"
        onClick={() => fijarLetra(LETRAS[Math.max(0, indice - 1)] ?? 'normal')}
      >
        <span aria-hidden="true" className="barra-pantalla-letra">
          A<sup>−</sup>
        </span>
        <span className="solo-lectores">Reducir letra</span>
      </button>
      <button
        type="button"
        className="barra-pantalla-boton"
        disabled={indice >= LETRAS.length - 1}
        title="Aumentar letra"
        onClick={() => fijarLetra(LETRAS[Math.min(LETRAS.length - 1, indice + 1)] ?? 'mayor')}
      >
        <span aria-hidden="true" className="barra-pantalla-letra">
          A<sup>+</sup>
        </span>
        <span className="solo-lectores">Aumentar letra</span>
      </button>
      <button
        type="button"
        className="barra-pantalla-boton"
        title="Contáctenos"
        onClick={irAContacto}
      >
        <Telefono tamano={18} />
        <span className="solo-lectores">Contáctenos</span>
      </button>
    </div>
  );
}

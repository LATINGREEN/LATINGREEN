import {
  CONTRASTES,
  ETIQUETA_CONTRASTE,
  ETIQUETA_LETRA,
  LETRAS,
  useAccesibilidad,
} from '../api/accesibilidad';
import { Contraste as IconoContraste, Letra as IconoLetra } from './Iconos';

/**
 * Controles de contraste y tamaño de letra.
 *
 * Exigidos por la Fase 4: «el manual muestra controles de contraste y tamaño
 * de letra. Impleméntalos y cumple WCAG 2.1 AA.»
 *
 * Se implementan como dos grupos de radio y NO como dos botones que ciclan.
 * Un botón que cicla obliga a pulsar hasta acertar y no dice en qué estado
 * está; un grupo de radio anuncia las opciones y la seleccionada, que es lo
 * que un lector de pantalla necesita. Van en la barra superior, visibles
 * siempre, porque quien los necesita los necesita antes de poder navegar para
 * buscarlos en una pantalla de ajustes.
 */
export function ControlesAccesibilidad(): JSX.Element {
  const { contraste, letra, fijarContraste, fijarLetra } = useAccesibilidad();

  return (
    <div className="acc">
      <fieldset className="acc-grupo">
        <legend className="solo-lectores">Contraste de la pantalla</legend>
        <span className="acc-icono" aria-hidden="true">
          <IconoContraste tamano={15} />
        </span>
        {CONTRASTES.map((valor) => (
          <label
            key={valor}
            className={`acc-opcion ${contraste === valor ? 'es-activa' : ''}`}
            title={ETIQUETA_CONTRASTE[valor]}
          >
            <input
              type="radio"
              name="contraste"
              value={valor}
              checked={contraste === valor}
              onChange={() => fijarContraste(valor)}
              className="solo-lectores"
            />
            <span aria-hidden="true">{ETIQUETA_CONTRASTE[valor].charAt(0)}</span>
            <span className="solo-lectores">{ETIQUETA_CONTRASTE[valor]}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="acc-grupo">
        <legend className="solo-lectores">Tamaño de la letra</legend>
        <span className="acc-icono" aria-hidden="true">
          <IconoLetra tamano={15} />
        </span>
        {LETRAS.map((valor, indice) => (
          <label
            key={valor}
            className={`acc-opcion ${letra === valor ? 'es-activa' : ''}`}
            title={ETIQUETA_LETRA[valor]}
          >
            <input
              type="radio"
              name="letra"
              value={valor}
              checked={letra === valor}
              onChange={() => fijarLetra(valor)}
              className="solo-lectores"
            />
            <span aria-hidden="true" style={{ fontSize: `${0.72 + indice * 0.16}rem` }}>
              A
            </span>
            <span className="solo-lectores">{ETIQUETA_LETRA[valor]}</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

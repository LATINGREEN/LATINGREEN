import { useState } from 'react';
import { Ancla } from './Iconos';

/**
 * Los dos emblemas que muestra el Manual del Usuario PAID: el escudo de la
 * Armada (ancla con escudo) y el emblema de la Jefatura de Acción Integral y
 * Desarrollo. Los archivos están en `public/identidad/` (ver su LEEME).
 *
 * Si un archivo falta, se muestra el ancla de la interfaz en su lugar: nunca
 * una imagen rota, y nunca un emblema inventado.
 *
 * `alt=""` cuando el nombre de la entidad va escrito al lado —el lector lo
 * leería dos veces—; con texto alternativo cuando el emblema va solo.
 */
function Emblema({
  archivo,
  alto,
  alternativo,
  clase,
}: {
  /** Ruta completa y literal: el empaquetado de la demostración la busca así. */
  readonly archivo: string;
  readonly alto: number;
  readonly alternativo: string;
  readonly clase?: string | undefined;
}): JSX.Element {
  const [falta, setFalta] = useState(false);
  if (falta) {
    return (
      <span className={`emblema-respaldo ${clase ?? ''}`} aria-hidden="true">
        <Ancla tamano={Math.round(alto * 0.6)} />
      </span>
    );
  }
  return (
    <img
      src={archivo}
      alt={alternativo}
      height={alto}
      className={`emblema ${clase ?? ''}`}
      style={{ height: `${alto / 16}rem`, width: 'auto' }}
      onError={() => setFalta(true)}
    />
  );
}

export function EscudoArmada({
  alto,
  alternativo = '',
  clase,
}: {
  readonly alto: number;
  readonly alternativo?: string;
  readonly clase?: string;
}): JSX.Element {
  return <Emblema archivo="/identidad/escudo-armada.webp" alto={alto} alternativo={alternativo} clase={clase} />;
}

export function EmblemaJacid({
  alto,
  alternativo = '',
  clase,
}: {
  readonly alto: number;
  readonly alternativo?: string;
  readonly clase?: string;
}): JSX.Element {
  return <Emblema archivo="/identidad/emblema-jacid.webp" alto={alto} alternativo={alternativo} clase={clase} />;
}

/** «ARMADA / DE COLOMBIA» como en el logotipo, en texto. */
export function LogotipoArmada({ alto = 44 }: { readonly alto?: number }): JSX.Element {
  return (
    <span className="logotipo-armada">
      <EscudoArmada alto={alto} />
      <span className="logotipo-armada-texto">
        <span className="logotipo-armada-1">ARMADA</span>
        <span className="logotipo-armada-2">DE COLOMBIA</span>
      </span>
    </span>
  );
}

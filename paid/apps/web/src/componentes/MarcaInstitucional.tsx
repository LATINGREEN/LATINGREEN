import { useState } from 'react';
import { Ancla } from './Iconos';

/**
 * El logotipo institucional, si está; el ancla de la interfaz, si no.
 *
 * Lee `public/identidad/escudo.svg`, que es donde va el material del Manual de
 * Identidad Visual de la ARC (ver `public/identidad/LEEME.md`). Mientras no
 * esté, se muestra el ancla — y la interfaz lo sabe: no finge tener un escudo.
 *
 * La Ley 2345 de 2023 pide el logotipo acompañado del NOMBRE DE LA ENTIDAD, así
 * que el nombre va siempre, esté o no el escudo.
 */
export function MarcaInstitucional({
  tamano,
  clase,
}: {
  readonly tamano: number;
  readonly clase: string;
}): JSX.Element {
  const [sinEscudo, setSinEscudo] = useState(false);

  if (sinEscudo) {
    return (
      <span className={clase} aria-hidden="true">
        <Ancla tamano={Math.round(tamano * 0.62)} />
      </span>
    );
  }
  return (
    <span className={`${clase} es-escudo`}>
      <img
        src="/identidad/escudo.svg"
        width={tamano}
        height={tamano}
        /* El nombre de la entidad va en texto al lado: el escudo es decorativo
           para un lector de pantalla, que si no leería el nombre dos veces. */
        alt=""
        onError={() => setSinEscudo(true)}
      />
    </span>
  );
}

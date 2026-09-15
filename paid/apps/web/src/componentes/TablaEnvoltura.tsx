import type { ReactNode } from 'react';

/**
 * Envoltura de una tabla que puede desplazarse en horizontal.
 *
 * ⚠️ Existe por una razón concreta, y la encontró la revisión automática de la
 * Puerta 4: `overflow-x: auto` crea una región desplazable, y una región
 * desplazable a la que no se puede llegar con el teclado deja su contenido
 * inalcanzable para quien no usa ratón. Es WCAG 2.1.1 (`Keyboard`), y axe lo
 * reporta como `scrollable-region-focusable`.
 *
 * Por eso lleva `tabIndex={0}`: hace la región enfocable, y una región
 * enfocable se desplaza con las flechas. Y lleva `role="region"` con nombre,
 * para que al llegar ahí tabulando el lector de pantalla diga QUÉ es en lugar
 * de anunciar un grupo sin nombre.
 *
 * Está en un componente y no repetido en cada pantalla porque lo que se
 * arregla en cinco sitios se rompe en el sexto.
 */
export function TablaEnvoltura({
  nombre,
  children,
}: {
  /** Qué contiene la tabla. Lo anuncia el lector al entrar en la región. */
  readonly nombre: string;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div className="tabla-envoltura" role="region" aria-label={nombre} tabIndex={0}>
      {children}
    </div>
  );
}

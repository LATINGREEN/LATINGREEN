import { useEffect, useRef } from 'react';
import { Alerta } from './Iconos';

/**
 * Resumen de errores al pie de un envío fallido.
 *
 * Antes el formulario decía «Revise los campos marcados» y ya: en un
 * formulario largo, con el error tres pantallas más abajo, la persona tenía
 * que ir a buscarlo. Aquí se nombra cada campo y cada nombre es un enlace que
 * lleva el foco a él.
 *
 * Recibe el foco al aparecer, para que un lector de pantalla lo lea sin que
 * haya que buscarlo — es el patrón que recomienda la guía de accesibilidad de
 * GOV.UK, y el que WCAG 3.3.1 pide en esencia: identificar el error y
 * describirlo en texto.
 */
export function ResumenErrores({
  errores,
  rotulos,
  mensaje,
}: {
  readonly errores: Readonly<Record<string, string>>;
  /** Nombre visible de cada campo, por su clave. */
  readonly rotulos: Readonly<Record<string, string>>;
  /** Un error que no es de un campo concreto (por ejemplo, del servidor). */
  readonly mensaje?: string | null | undefined;
}): JSX.Element | null {
  const caja = useRef<HTMLDivElement | null>(null);
  const claves = Object.keys(errores);
  const hay = claves.length > 0 || (mensaje !== null && mensaje !== undefined);

  useEffect(() => {
    if (hay) caja.current?.focus();
  }, [hay, errores, mensaje]);

  if (!hay) return null;

  return (
    <div className="aviso aviso-mal resumen-errores" role="alert" tabIndex={-1} ref={caja}>
      <span className="aviso-icono">
        <Alerta tamano={18} />
      </span>
      <div>
        <p>
          <strong>
            {mensaje ??
              (claves.length === 1
                ? 'Hay un dato por corregir.'
                : `Hay ${claves.length} datos por corregir.`)}
          </strong>
        </p>
        {claves.length > 0 && (
          <ul>
            {claves.map((clave) => (
              <li key={clave}>
                <a
                  href={`#${idDeCampo(clave)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    const destino = document.getElementById(idDeCampo(clave));
                    destino?.focus();
                    destino?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                  }}
                >
                  {rotulos[clave] ?? clave}
                </a>
                : {errores[clave]}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Los campos de coordenadas llevan prefijo en su `id`. */
function idDeCampo(clave: string): string {
  return clave.startsWith('latitud') || clave.startsWith('longitud') ? `gms-${clave}` : clave;
}

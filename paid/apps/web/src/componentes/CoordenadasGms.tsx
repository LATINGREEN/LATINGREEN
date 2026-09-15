import { useMemo, useState } from 'react';
import { aDecimal, estaEnColombia, formatearGms } from '@paid/schema';
import type { CoordenadaGms } from '@paid/schema';
import { MapaUbicacion } from './MapaUbicacion';
import { Mapa } from './Iconos';

/**
 * R13 — Georreferenciación.
 *
 * «Se almacenan los ocho componentes GMS tal como los digita el usuario; las
 * decimales son columnas generadas, que no pueden divergir.»
 *
 * Aquí eso se traduce en dos decisiones:
 *
 * 1. Se digitan los OCHO componentes, no las decimales. El usuario tiene los
 *    grados-minutos-segundos en el clavegrama; pedirle decimales lo obligaría
 *    a convertir a mano, que es exactamente donde se cometen los errores.
 *
 * 2. **La conversión a decimales se muestra en vivo** (Fase 4, punto 5: «con
 *    conversión visible a decimales»). Y se calcula con `aDecimal()` de
 *    `@paid/schema`, la MISMA función cuya expresión SQL espejo genera la
 *    columna de la base. Si el número de la pantalla no fuera el que la base va
 *    a guardar, el usuario estaría verificando otra cosa.
 *
 * El botón «Ver ubicación» es del manual. Lo que muestra depende de Q11: ver
 * `MapaUbicacion`.
 */

export interface CoordenadasGmsProps {
  readonly valor: CoordenadaGms;
  readonly onCambio: (valor: CoordenadaGms) => void;
  readonly errores?: Readonly<Record<string, string>>;
  readonly lugar?: string;
}

type CampoNumero = 'Grados' | 'Minutos' | 'Segundos';

export function CoordenadasGms({
  valor,
  onCambio,
  errores = {},
  lugar,
}: CoordenadasGmsProps): JSX.Element {
  const [verMapa, setVerMapa] = useState(false);

  const decimales = useMemo(
    () => ({
      latitud: aDecimal(
        valor.latitudGrados,
        valor.latitudMinutos,
        valor.latitudSegundos,
        valor.latitudHemisferio,
      ),
      longitud: aDecimal(
        valor.longitudGrados,
        valor.longitudMinutos,
        valor.longitudSegundos,
        valor.longitudHemisferio,
      ),
    }),
    [valor],
  );

  const enColombia = estaEnColombia(decimales);

  function cambiar(campo: keyof CoordenadaGms, crudo: string): void {
    // El separador decimal es el PUNTO (A.2.4). Una coma se convierte en punto
    // al teclear en lugar de rechazarse: en los segundos, el usuario escribe
    // «27,5» por costumbre del teclado, y en un campo numérico convertirlo es
    // ayuda, no interpretación ambigua — el valor es inequívoco.
    const limpio = crudo.replace(',', '.');
    const numero = limpio === '' ? 0 : Number(limpio);
    if (Number.isNaN(numero)) return;
    onCambio({ ...valor, [campo]: numero });
  }

  function campoNumero(
    eje: 'latitud' | 'longitud',
    parte: CampoNumero,
    maximo: number,
    paso: number,
  ): JSX.Element {
    const clave = `${eje}${parte}` as keyof CoordenadaGms;
    const id = `gms-${clave}`;
    const error = errores[clave];
    return (
      <div className="gms-campo">
        <label htmlFor={id} className="gms-rotulo">
          {parte}
        </label>
        <input
          id={id}
          className="entrada datos gms-entrada"
          type="number"
          min={0}
          max={maximo}
          step={paso}
          value={String(valor[clave])}
          onChange={(e) => cambiar(clave, e.target.value)}
          aria-invalid={error !== undefined}
          {...(error !== undefined ? { 'aria-describedby': `${id}-error` } : {})}
          required
        />
        {error !== undefined && (
          <p className="error" id={`${id}-error`}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <fieldset className="gms">
      <legend className="rotulo">Georreferenciación</legend>
      <p className="ayuda gms-ayuda">
        Digite los grados, minutos y segundos tal como aparecen en el clavegrama.
        Las decimales se calculan solas: <strong>no se digitan</strong>, para que no
        puedan diferir de lo que se guarda.
      </p>

      <div className="gms-ejes">
        <div className="gms-eje">
          <p className="gms-eje-nombre">Latitud</p>
          <div className="gms-fila">
            {campoNumero('latitud', 'Grados', 90, 1)}
            {campoNumero('latitud', 'Minutos', 59, 1)}
            {campoNumero('latitud', 'Segundos', 59.99999, 0.001)}
            <div className="gms-campo">
              <label htmlFor="gms-latitudHemisferio" className="gms-rotulo">
                Hemisferio
              </label>
              <select
                id="gms-latitudHemisferio"
                className="entrada gms-entrada"
                value={valor.latitudHemisferio}
                onChange={(e) =>
                  onCambio({
                    ...valor,
                    latitudHemisferio: e.target.value as CoordenadaGms['latitudHemisferio'],
                  })
                }
              >
                <option value="N">N — Norte</option>
                <option value="S">S — Sur</option>
              </select>
            </div>
          </div>
        </div>

        <div className="gms-eje">
          <p className="gms-eje-nombre">Longitud</p>
          <div className="gms-fila">
            {campoNumero('longitud', 'Grados', 180, 1)}
            {campoNumero('longitud', 'Minutos', 59, 1)}
            {campoNumero('longitud', 'Segundos', 59.99999, 0.001)}
            <div className="gms-campo">
              <label htmlFor="gms-longitudHemisferio" className="gms-rotulo">
                Hemisferio
              </label>
              <select
                id="gms-longitudHemisferio"
                className="entrada gms-entrada"
                value={valor.longitudHemisferio}
                onChange={(e) =>
                  onCambio({
                    ...valor,
                    longitudHemisferio: e.target.value as CoordenadaGms['longitudHemisferio'],
                  })
                }
              >
                <option value="W">W — Oeste</option>
                <option value="E">E — Este</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* La conversión, en vivo. `aria-live` para que un lector la anuncie al
          cambiar los grados sin tener que ir a buscarla. */}
      <div className="gms-derivado" aria-live="polite">
        <div className="gms-derivado-cifras">
          <div>
            <span className="rotulo">GMS digitadas</span>
            <p className="datos">
              {formatearGms(
                valor.latitudGrados,
                valor.latitudMinutos,
                valor.latitudSegundos,
                valor.latitudHemisferio,
              )}
              {'  '}
              {formatearGms(
                valor.longitudGrados,
                valor.longitudMinutos,
                valor.longitudSegundos,
                valor.longitudHemisferio,
              )}
            </p>
          </div>
          <div>
            <span className="rotulo">Decimales calculadas</span>
            <p className="datos gms-decimales">
              {decimales.latitud.toFixed(6)}, {decimales.longitud.toFixed(6)}
            </p>
          </div>
          <div>
            <span className="rotulo">Territorio</span>
            <p>
              <span
                className={`distintivo ${
                  enColombia ? 'distintivo-completo' : 'distintivo-incompleto'
                }`}
              >
                {enColombia ? 'Dentro de Colombia' : 'Fuera de Colombia'}
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          className="boton boton-secundario"
          onClick={() => setVerMapa((v) => !v)}
          aria-expanded={verMapa}
        >
          <Mapa tamano={17} />
          {verMapa ? 'Ocultar ubicación' : 'Ver ubicación'}
        </button>
      </div>

      {verMapa && (
        <div className="gms-mapa emerge">
          <MapaUbicacion punto={decimales} {...(lugar !== undefined ? { etiqueta: lugar } : {})} />
        </div>
      )}
    </fieldset>
  );
}

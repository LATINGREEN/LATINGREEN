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
 * Tres decisiones:
 *
 * 1. Se digitan los OCHO componentes, no las decimales. El usuario tiene los
 *    grados-minutos-segundos en el clavegrama; pedirle decimales lo obligaría
 *    a convertir a mano, que es exactamente donde se cometen los errores.
 *
 * 2. **La conversión a decimales se muestra en vivo** (Fase 4, punto 5), con
 *    `aDecimal()` de `@paid/schema`: la MISMA función cuya expresión SQL
 *    espejo genera la columna.
 *
 * 3. ⚠️ **EL FORMULARIO ARRANCA VACÍO.** Una versión anterior arrancaba en
 *    10° N, 75° W: un punto plausible cerca de Cartagena. Quien olvidara
 *    cambiarlo registraba una ubicación falsa que parecía correcta, pasaba el
 *    control de «dentro de Colombia» y llegaba a ArcGIS. Es literalmente el
 *    anti-patrón P6: «un punto equivocado es peor que uno ausente, porque
 *    parece plausible». Ahora cada parte está vacía hasta que se digita, y el
 *    formulario no guarda sin ellas.
 *
 *    El hemisferio de la LATITUD también arranca sin elegir: Leticia está a
 *    4° S, y un 4° N con la misma longitud cae dentro de Colombia, en el
 *    Vichada. El de la LONGITUD sí arranca en W, y no es una suposición:
 *    Colombia entera está al oeste de Greenwich, así que E es siempre un error.
 */

type ParteNumerica =
  | 'latitudGrados'
  | 'latitudMinutos'
  | 'latitudSegundos'
  | 'longitudGrados'
  | 'longitudMinutos'
  | 'longitudSegundos';

/** Lo que el formulario tiene mientras se digita: cualquier parte puede faltar. */
export type BorradorGms = {
  readonly [K in ParteNumerica]: string;
} & {
  readonly latitudHemisferio: '' | 'N' | 'S';
  readonly longitudHemisferio: 'E' | 'W';
};

export const GMS_VACIO: BorradorGms = {
  latitudGrados: '',
  latitudMinutos: '',
  latitudSegundos: '',
  latitudHemisferio: '',
  longitudGrados: '',
  longitudMinutos: '',
  longitudSegundos: '',
  longitudHemisferio: 'W',
};

const PARTES: readonly ParteNumerica[] = [
  'latitudGrados',
  'latitudMinutos',
  'latitudSegundos',
  'longitudGrados',
  'longitudMinutos',
  'longitudSegundos',
];

/**
 * Del borrador a una coordenada, o los campos que faltan.
 *
 * No valida rangos: eso lo hace el esquema Zod compartido, que es el mismo del
 * servidor. Aquí solo se distingue «vacío» de «cero» — la distinción que un
 * `Number('')` borraba, porque vale 0.
 */
export function completarGms(
  borrador: BorradorGms,
): { readonly coordenada: CoordenadaGms } | { readonly faltan: Readonly<Record<string, string>> } {
  const faltan: Record<string, string> = {};
  for (const parte of PARTES) {
    if (borrador[parte].trim() === '') faltan[parte] = 'Falta este valor.';
  }
  if (borrador.latitudHemisferio === '') {
    faltan['latitudHemisferio'] = 'Elija norte o sur.';
  }
  if (Object.keys(faltan).length > 0) return { faltan };
  return {
    coordenada: {
      latitudGrados: Number(borrador.latitudGrados),
      latitudMinutos: Number(borrador.latitudMinutos),
      latitudSegundos: Number(borrador.latitudSegundos),
      latitudHemisferio: borrador.latitudHemisferio as 'N' | 'S',
      longitudGrados: Number(borrador.longitudGrados),
      longitudMinutos: Number(borrador.longitudMinutos),
      longitudSegundos: Number(borrador.longitudSegundos),
      longitudHemisferio: borrador.longitudHemisferio,
    },
  };
}

/** Una coordenada guardada, de vuelta al borrador para editarla. */
export function aBorradorGms(c: {
  readonly latitudGrados: number;
  readonly latitudMinutos: number;
  readonly latitudSegundos: number;
  readonly latitudHemisferio: string;
  readonly longitudGrados: number;
  readonly longitudMinutos: number;
  readonly longitudSegundos: number;
  readonly longitudHemisferio: string;
}): BorradorGms {
  return {
    latitudGrados: String(c.latitudGrados),
    latitudMinutos: String(c.latitudMinutos),
    latitudSegundos: String(c.latitudSegundos),
    latitudHemisferio: c.latitudHemisferio === 'S' ? 'S' : 'N',
    longitudGrados: String(c.longitudGrados),
    longitudMinutos: String(c.longitudMinutos),
    longitudSegundos: String(c.longitudSegundos),
    longitudHemisferio: c.longitudHemisferio === 'E' ? 'E' : 'W',
  };
}

export interface CoordenadasGmsProps {
  readonly valor: BorradorGms;
  readonly onCambio: (valor: BorradorGms) => void;
  readonly errores?: Readonly<Record<string, string>>;
  readonly lugar?: string;
}

const ETIQUETA_PARTE: Record<'Grados' | 'Minutos' | 'Segundos', string> = {
  Grados: 'Grados',
  Minutos: 'Minutos',
  Segundos: 'Segundos',
};

export function CoordenadasGms({
  valor,
  onCambio,
  errores = {},
  lugar,
}: CoordenadasGmsProps): JSX.Element {
  const [verMapa, setVerMapa] = useState(false);

  const completa = useMemo(() => {
    const r = completarGms(valor);
    return 'coordenada' in r ? r.coordenada : null;
  }, [valor]);

  const decimales = useMemo(
    () =>
      completa === null
        ? null
        : {
            latitud: aDecimal(
              completa.latitudGrados,
              completa.latitudMinutos,
              completa.latitudSegundos,
              completa.latitudHemisferio,
            ),
            longitud: aDecimal(
              completa.longitudGrados,
              completa.longitudMinutos,
              completa.longitudSegundos,
              completa.longitudHemisferio,
            ),
          },
    [completa],
  );

  const enColombia = decimales !== null && estaEnColombia(decimales);

  function cambiar(campo: ParteNumerica, crudo: string): void {
    // El separador decimal es el PUNTO (A.2.4). Una coma se convierte en punto
    // al teclear: en los segundos se escribe «27,5» por costumbre del teclado,
    // y en un campo numérico convertirla es ayuda, no interpretación ambigua.
    const limpio = crudo.replace(',', '.').replace(/[^0-9.]/gu, '');
    onCambio({ ...valor, [campo]: limpio });
  }

  function campoNumero(
    eje: 'latitud' | 'longitud',
    parte: 'Grados' | 'Minutos' | 'Segundos',
    maximo: number,
  ): JSX.Element {
    const clave = `${eje}${parte}` as ParteNumerica;
    const id = `gms-${clave}`;
    const error = errores[clave];
    return (
      <div className="gms-campo">
        <label htmlFor={id} className="gms-rotulo">
          {ETIQUETA_PARTE[parte]}
        </label>
        {/*
         * `inputMode` y no `type="number"`: el campo numérico nativo acepta
         * «e», cambia el valor con la rueda del ratón al desplazar la página
         * —y en un formulario largo eso modifica coordenadas sin que nadie lo
         * note— y no deja distinguir vacío de cero.
         */}
        <input
          id={id}
          className="entrada datos gms-entrada"
          inputMode={parte === 'Segundos' ? 'decimal' : 'numeric'}
          autoComplete="off"
          value={valor[clave]}
          placeholder={parte === 'Segundos' ? '0.0' : '0'}
          onChange={(e) => cambiar(clave, e.target.value)}
          aria-invalid={error !== undefined}
          aria-describedby={error !== undefined ? `${id}-error` : `${id}-rango`}
          required
        />
        <span className="solo-lectores" id={`${id}-rango`}>
          De 0 a {maximo}.
        </span>
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
            {campoNumero('latitud', 'Grados', 90)}
            {campoNumero('latitud', 'Minutos', 59)}
            {campoNumero('latitud', 'Segundos', 59.99999)}
            <div className="gms-campo">
              <label htmlFor="gms-latitudHemisferio" className="gms-rotulo">
                Hemisferio
              </label>
              <select
                id="gms-latitudHemisferio"
                className="entrada gms-entrada"
                value={valor.latitudHemisferio}
                aria-invalid={errores['latitudHemisferio'] !== undefined}
                required
                onChange={(e) =>
                  onCambio({
                    ...valor,
                    latitudHemisferio: e.target.value as BorradorGms['latitudHemisferio'],
                  })
                }
              >
                <option value="">Elija…</option>
                <option value="N">N — Norte</option>
                <option value="S">S — Sur</option>
              </select>
              {errores['latitudHemisferio'] !== undefined && (
                <p className="error">{errores['latitudHemisferio']}</p>
              )}
            </div>
          </div>
        </div>

        <div className="gms-eje">
          <p className="gms-eje-nombre">Longitud</p>
          <div className="gms-fila">
            {campoNumero('longitud', 'Grados', 180)}
            {campoNumero('longitud', 'Minutos', 59)}
            {campoNumero('longitud', 'Segundos', 59.99999)}
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
                    longitudHemisferio: e.target.value as BorradorGms['longitudHemisferio'],
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
          completar los grados sin tener que ir a buscarla. */}
      <div className="gms-derivado" aria-live="polite">
        <div className="gms-derivado-cifras">
          <div>
            <span className="rotulo">GMS digitadas</span>
            <p className="datos">
              {completa === null
                ? '—'
                : `${formatearGms(
                    completa.latitudGrados,
                    completa.latitudMinutos,
                    completa.latitudSegundos,
                    completa.latitudHemisferio,
                  )}  ${formatearGms(
                    completa.longitudGrados,
                    completa.longitudMinutos,
                    completa.longitudSegundos,
                    completa.longitudHemisferio,
                  )}`}
            </p>
          </div>
          <div>
            <span className="rotulo">Decimales calculadas</span>
            <p className="datos gms-decimales">
              {decimales === null
                ? 'Se calculan al completar las ocho partes'
                : `${decimales.latitud.toFixed(6)}, ${decimales.longitud.toFixed(6)}`}
            </p>
          </div>
          <div>
            <span className="rotulo">Territorio</span>
            <p>
              {decimales === null ? (
                <span className="distintivo distintivo-neutro">Sin calcular</span>
              ) : (
                <span
                  className={`distintivo ${
                    enColombia ? 'distintivo-completo' : 'distintivo-incompleto'
                  }`}
                >
                  {enColombia ? 'Dentro de Colombia' : 'Fuera de Colombia'}
                </span>
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="boton boton-secundario"
          onClick={() => setVerMapa((v) => !v)}
          aria-expanded={verMapa}
          disabled={decimales === null}
        >
          <Mapa tamano={17} />
          {verMapa ? 'Ocultar ubicación' : 'Ver ubicación'}
        </button>
      </div>

      {verMapa && decimales !== null && (
        <div className="gms-mapa emerge">
          <MapaUbicacion punto={decimales} {...(lugar !== undefined ? { etiqueta: lugar } : {})} />
        </div>
      )}
    </fieldset>
  );
}

import { Alerta } from './Iconos';

/** Lo que el control guarda: sin responder, sí o no. */
export type SiNo = '' | 'SI' | 'NO';

export const aSiNo = (valor: boolean | null): SiNo =>
  valor === null ? '' : valor ? 'SI' : 'NO';

/** `undefined` si no se respondió: el esquema lo pide con palabras. */
export const deSiNo = (valor: SiNo): boolean | undefined =>
  valor === '' ? undefined : valor === 'SI';

/**
 * Pregunta de sí o no, como los desplegables «Ejc / Arc / Fac» y «Población
 * afecta» del manual (láminas 20 y 21).
 *
 * Arranca en «Seleccione…», nunca en «No». Un «No» preseleccionado es la
 * respuesta de quien no contestó, y en el consolidado se lee como «el EJC no
 * participó» (D-30). Por eso tampoco es una casilla: una casilla desmarcada
 * ya dice «no».
 */
export function CampoSiNo({
  id,
  rotulo,
  valor,
  onCambio,
  error,
  ayuda,
  fijo,
}: {
  readonly id: string;
  readonly rotulo: string;
  readonly valor: SiNo;
  readonly onCambio?: ((valor: SiNo) => void) | undefined;
  readonly error?: string | undefined;
  readonly ayuda?: string | undefined;
  /** Respuesta impuesta que no se puede cambiar (la ARC, R9). */
  readonly fijo?: boolean | undefined;
}): JSX.Element {
  const idAyuda = `${id}-ayuda`;
  const texto = error ?? ayuda;
  return (
    <div className="campo">
      <label htmlFor={id}>
        {rotulo}
        {fijo !== true && (
          <span className="obligatorio" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <select
        id={id}
        className="entrada"
        value={valor}
        required={fijo !== true}
        disabled={fijo === true}
        aria-invalid={error !== undefined}
        {...(texto !== undefined ? { 'aria-describedby': idAyuda } : {})}
        onChange={(e) => onCambio?.(e.target.value as SiNo)}
      >
        <option value="">Seleccione…</option>
        <option value="SI">Sí</option>
        <option value="NO">No</option>
      </select>
      {error !== undefined ? (
        <p className="error" id={idAyuda}>
          <Alerta tamano={15} /> {error}
        </p>
      ) : (
        ayuda !== undefined && (
          <p className="ayuda" id={idAyuda}>
            {ayuda}
          </p>
        )
      )}
    </div>
  );
}

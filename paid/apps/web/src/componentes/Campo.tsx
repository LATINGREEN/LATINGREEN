import { Alerta } from './Iconos';

/**
 * Campo de texto con rótulo visible, ayuda y error asociados por `id`.
 *
 * Vivía dentro de `Tripulantes.tsx` y lo importaban otras tres pantallas desde
 * ahí: un componente compartido escondido en una página es un componente que
 * alguien cambia pensando que solo afecta a esa página.
 */
export function Campo({
  id,
  rotulo,
  valor,
  onCambio,
  obligatorio = false,
  datos = false,
  multilinea = false,
  tipo = 'text',
  modo,
  ayuda,
  error,
  alPulsarIntro,
}: {
  readonly id: string;
  readonly rotulo: string;
  readonly valor: string;
  readonly onCambio: (valor: string) => void;
  readonly obligatorio?: boolean;
  readonly datos?: boolean;
  /** Área de texto en lugar de una línea. */
  readonly multilinea?: boolean;
  readonly tipo?: 'text' | 'email';
  readonly modo?: 'text' | 'numeric' | 'decimal' | undefined;
  /* `| undefined` explícito: el proyecto compila con `exactOptionalPropertyTypes`
     y estos llegan de mapas donde la ausencia ES `undefined`. */
  readonly ayuda?: string | undefined;
  readonly error?: string | undefined;
  /** Intro en un campo de una línea: la acción principal del formulario. */
  readonly alPulsarIntro?: (() => void) | undefined;
}): JSX.Element {
  const idAyuda = `${id}-ayuda`;
  const describe = error !== undefined || ayuda !== undefined ? idAyuda : undefined;
  const comun = {
    id,
    className: `entrada ${datos ? 'datos' : ''}`,
    value: valor,
    required: obligatorio,
    'aria-invalid': error !== undefined,
    ...(describe !== undefined ? { 'aria-describedby': describe } : {}),
  };

  return (
    <div className="campo">
      <label htmlFor={id}>
        {rotulo}
        {obligatorio && (
          <span className="obligatorio" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {multilinea ? (
        <textarea {...comun} onChange={(e) => onCambio(e.target.value)} />
      ) : (
        <input
          {...comun}
          type={tipo}
          {...(modo !== undefined ? { inputMode: modo } : {})}
          onChange={(e) => onCambio(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && alPulsarIntro !== undefined) {
              e.preventDefault();
              alPulsarIntro();
            }
          }}
        />
      )}
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

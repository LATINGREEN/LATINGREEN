import { Alerta } from './Iconos';

/**
 * Fecha en `dd/mm/aaaa` (A.2.4).
 *
 * Texto y no `<input type="date">`: el selector nativo presenta el formato
 * según la configuración regional del EQUIPO, y el manual exige dd/mm/aaaa. En
 * un equipo mal configurado se vería mm/dd/aaaa y el 3 de mayo quedaría como
 * el 5 de marzo sin que nada fallara.
 *
 * Dos ayudas que no cambian el formato:
 *
 * - Las barras se ponen solas al teclear: «05032026» queda «05/03/2026». Es
 *   el error de digitación más frecuente con este formato y no hay nada que
 *   interpretar — ocho dígitos solo tienen una lectura en dd/mm/aaaa.
 * - «Hoy», porque la fecha de registro suele serlo.
 */
export function CampoFecha({
  id,
  rotulo,
  valor,
  onCambio,
  obligatorio = true,
  ayuda,
  error,
}: {
  readonly id: string;
  readonly rotulo: string;
  readonly valor: string;
  readonly onCambio: (v: string) => void;
  readonly obligatorio?: boolean;
  readonly ayuda?: string | undefined;
  readonly error?: string | undefined;
}): JSX.Element {
  const idAyuda = `${id}-ayuda`;
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
      <div className="campo-fecha">
        <input
          id={id}
          className="entrada datos"
          value={valor}
          onChange={(e) => onCambio(enmascararFecha(e.target.value, valor))}
          placeholder="dd/mm/aaaa"
          inputMode="numeric"
          maxLength={10}
          autoComplete="off"
          aria-invalid={error !== undefined}
          aria-describedby={idAyuda}
          required={obligatorio}
        />
        <button
          type="button"
          className="boton boton-secundario"
          onClick={() => onCambio(hoyDdMmAaaa())}
          aria-label={`${rotulo}: usar la fecha de hoy`}
        >
          Hoy
        </button>
      </div>
      {error !== undefined ? (
        <p className="error" id={idAyuda}>
          <Alerta tamano={15} /> {error}
        </p>
      ) : (
        <p className="ayuda" id={idAyuda}>
          {ayuda ?? 'Formato dd/mm/aaaa. Por ejemplo, 05/03/2026.'}
        </p>
      )}
    </div>
  );
}

/**
 * Pone las barras mientras se teclea, sin estorbar al borrar.
 *
 * Si el valor nuevo es más corto que el anterior la persona está borrando, y
 * volver a poner la barra que acaba de quitar la dejaría atrapada. Solo se
 * reformatea al AÑADIR.
 */
export function enmascararFecha(nuevo: string, anterior: string): string {
  if (nuevo.length < anterior.length) return nuevo;
  const digitos = nuevo.replace(/\D/gu, '').slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

/**
 * Hoy en Colombia, no en UTC. Entre las 19:00 y la medianoche de Bogotá, UTC
 * ya es mañana: `toISOString()` daría la fecha del día siguiente.
 */
export function hoyDdMmAaaa(ahora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(ahora);
  const parte = (tipo: string): string => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${parte('day')}/${parte('month')}/${parte('year')}`;
}

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { PersonalEnListado } from '@paid/schema';
import { api } from '../api/cliente';
import { Alerta } from './Iconos';

/**
 * Responsable de una herramienta AID (lámina 46): alguien inscrito en
 * Tripulantes A.I. › Personal.
 *
 * Es R8 visto desde la pantalla: el maestro de personal tiene que existir
 * ANTES. Si todavía no hay nadie registrado, el desplegable no aparece vacío
 * sin explicación: dice qué hacer y enlaza al lugar donde se hace.
 *
 * Las opciones salen del mismo listado que ve la unidad, así que RLS ya las
 * acota: solo se ofrece a quien la unidad puede ver, que es también lo único
 * que el servidor acepta.
 */
export function CampoResponsable({
  id,
  valor,
  onCambio,
  error,
}: {
  readonly id: string;
  readonly valor: string;
  readonly onCambio: (valor: string) => void;
  readonly error?: string | undefined;
}): JSX.Element {
  const personal = useQuery({
    queryKey: ['personal', ''],
    queryFn: () => api.obtener<{ readonly filas: readonly PersonalEnListado[] }>('/personal'),
  });
  const filas = personal.data?.filas ?? [];
  const vacio = personal.isSuccess && filas.length === 0;
  const idAyuda = `${id}-ayuda`;

  return (
    <div className="campo">
      <label htmlFor={id}>
        Responsable
        <span className="obligatorio" aria-hidden="true">
          *
        </span>
      </label>
      <select
        id={id}
        className="entrada"
        value={valor}
        required
        disabled={personal.isPending || vacio}
        aria-busy={personal.isLoading}
        aria-invalid={error !== undefined}
        aria-describedby={idAyuda}
        onChange={(e) => onCambio(e.target.value)}
      >
        <option value="">
          {personal.isLoading ? 'Cargando…' : vacio ? 'Nadie registrado en Personal' : 'Seleccione…'}
        </option>
        {filas.map((p) => (
          <option key={p.id} value={String(p.id)}>
            {[p.grado, p.nombres, p.apellidos].filter((x) => x !== null && x !== '').join(' ')} ·{' '}
            {p.tipoDocumento} {p.numeroDocumento}
          </option>
        ))}
      </select>
      {error !== undefined ? (
        <p className="error" id={idAyuda}>
          <Alerta tamano={15} /> {error}
        </p>
      ) : vacio ? (
        <p className="ayuda" id={idAyuda}>
          El responsable tiene que estar inscrito en Personal, y todavía no hay nadie.{' '}
          <Link to="/tripulantes">Registrarlo en Tripulantes A.I. › Personal</Link>.
        </p>
      ) : (
        <p className="ayuda" id={idAyuda}>
          Quien responde por la herramienta en el inventario fiscal. Si no aparece,
          regístrelo primero en Tripulantes A.I. › Personal.
        </p>
      )}
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import type { EntidadEnListado } from '@paid/schema';
import { api } from '../api/cliente';
import { Alerta } from './Iconos';

/**
 * Selector de una Entidad A.I. del maestro.
 *
 * ⚠️ R8 en pantalla. Las pestañas «Entidades Servicios» y «Entidades
 * Apoyadas», y el donante de «Bienes Donados», apuntan a `ai.entidad`, que es
 * uno de los tres maestros de precedencia. Un campo numérico donde hay que
 * escribir el identificador no solo es incómodo: es imposible de diligenciar,
 * porque el identificador no aparece en ninguna pantalla. Y si por casualidad
 * se acertara con uno de otra unidad, RLS lo ocultaría y el error llegaría
 * como una violación de clave foránea sin explicación.
 *
 * Cuando el maestro está vacío, el estado vacío DICE qué hacer —ir a registrar
 * una entidad— en lugar de dejar un desplegable sin opciones. Eso es R8
 * explicado donde importa: en el momento en que estorba.
 */
export function CampoEntidad({
  id,
  rotulo,
  valor,
  onCambio,
  obligatorio = false,
  error,
}: {
  readonly id: string;
  readonly rotulo: string;
  readonly valor: string;
  readonly onCambio: (valor: string) => void;
  readonly obligatorio?: boolean;
  readonly error?: string | undefined;
}): JSX.Element {
  const entidades = useQuery({
    queryKey: ['entidades', ''],
    queryFn: () => api.obtener<{ filas: EntidadEnListado[]; total: number }>('/entidades'),
    staleTime: 60_000,
  });

  const filas = entidades.data?.filas ?? [];
  const vacio = entidades.isSuccess && filas.length === 0;
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
      <select
        id={id}
        className="entrada"
        value={valor}
        required={obligatorio}
        disabled={entidades.isPending || vacio}
        aria-invalid={error !== undefined}
        aria-describedby={idAyuda}
        onChange={(e) => onCambio(e.target.value)}
      >
        <option value="">
          {entidades.isPending ? 'Cargando…' : vacio ? 'Sin entidades' : 'Seleccione…'}
        </option>
        {filas.map((entidad) => (
          <option key={entidad.id} value={String(entidad.id)}>
            {entidad.nombre}
            {entidad.municipio !== null ? ` — ${entidad.municipio}` : ''}
          </option>
        ))}
      </select>

      {error !== undefined ? (
        <p className="error" id={idAyuda}>
          <Alerta tamano={15} /> {error}
        </p>
      ) : (
        <p className="ayuda" id={idAyuda}>
          {vacio
            ? 'No hay entidades en el maestro. Regístrela primero en Entidades A.I.: sin ella esta pestaña no se puede diligenciar.'
            : 'Solo aparecen las entidades del ámbito de su unidad.'}
        </p>
      )}
    </div>
  );
}

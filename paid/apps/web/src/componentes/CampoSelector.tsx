import type { CatalogoExpuesto } from '@paid/schema';
import { useCatalogo } from '../api/catalogos';
import { Alerta } from './Iconos';

/**
 * Desplegable alimentado por un catálogo de `ref`.
 *
 * Tres cosas que resuelve en un sitio para que ninguna pantalla las repita:
 *
 * 1. La opción vacía dice «Seleccione…» y no está preseleccionada con un valor
 *    real. Un catálogo con la primera opción marcada mete un dato que nadie
 *    eligió, y para R18 (COAMI) eso sería una participación inventada.
 *
 * 2. Cuando el catálogo está VACÍO lo dice, en lugar de mostrar un desplegable
 *    sin opciones. Varios catálogos de `ref` están deliberadamente vacíos
 *    mientras JACID no responda, y un control vacío sin explicación parece un
 *    defecto de la aplicación.
 *
 * 3. El error de validación se asocia con `aria-describedby`, no solo con
 *    color: sin eso un lector de pantalla anuncia el campo sin el motivo.
 */
export interface CampoSelectorProps {
  readonly id: string;
  readonly rotulo: string;
  readonly catalogo: CatalogoExpuesto;
  readonly valor: string;
  readonly onCambio: (valor: string) => void;
  readonly obligatorio?: boolean;
  /*
   * `| undefined` explicito, no solo `?`. El proyecto compila con
   * `exactOptionalPropertyTypes`, que distingue «la propiedad no esta» de «la
   * propiedad vale undefined». Estas tres se pasan desde un mapa de errores
   * donde la ausencia ES `undefined`, asi que hay que admitirlo.
   */
  readonly idDepartamento?: number | undefined;
  readonly ayuda?: string | undefined;
  readonly error?: string | undefined;
  /**
   * Qué falta para poder cargar las opciones. Se muestra en lugar de
   * «Cargando…» cuando la consulta todavía no puede salir.
   */
  readonly requisito?: string | undefined;
}

export function CampoSelector({
  id,
  rotulo,
  catalogo,
  valor,
  onCambio,
  obligatorio = false,
  idDepartamento,
  ayuda,
  error,
  requisito,
}: CampoSelectorProps): JSX.Element {
  const opciones = useCatalogo(catalogo, idDepartamento);
  const vacio = opciones.isSuccess && opciones.data.length === 0;
  const idAyuda = `${id}-ayuda`;

  /*
   * ⚠️ `isLoading`, no `isPending`.
   *
   * Con `enabled: false` —el caso del municipio mientras no hay
   * departamento—, TanStack Query deja la consulta en `isPending` para
   * siempre, porque nunca ha salido. El desplegable decía «Cargando…»
   * indefinidamente sobre algo que no estaba cargando y que nunca iba a
   * cargar: el usuario espera a que termine algo que no ha empezado.
   *
   * `isLoading` es `isPending && isFetching`: cierto solo mientras hay una
   * petición en vuelo de verdad.
   */
  const cargando = opciones.isLoading;
  const esperandoRequisito = opciones.isPending && !cargando;

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
        disabled={opciones.isPending || vacio}
        aria-busy={cargando}
        aria-invalid={error !== undefined}
        aria-describedby={idAyuda}
        onChange={(e) => onCambio(e.target.value)}
      >
        <option value="">
          {cargando
            ? 'Cargando…'
            : esperandoRequisito
              ? (requisito ?? 'Sin opciones')
              : vacio
                ? 'Sin opciones'
                : 'Seleccione…'}
        </option>
        {(opciones.data ?? []).map((opcion) => (
          <option key={opcion.id} value={String(opcion.id)}>
            {opcion.nombre}
          </option>
        ))}
      </select>

      {error !== undefined && (
        <p className="error" id={idAyuda}>
          <Alerta tamano={15} /> {error}
        </p>
      )}
      {error === undefined && esperandoRequisito && requisito !== undefined && (
        <p className="ayuda" id={idAyuda}>
          {requisito}
        </p>
      )}
      {error === undefined && !esperandoRequisito && vacio && (
        <p className="ayuda" id={idAyuda}>
          Este catálogo está vacío: lo diligencia JACID. No es un defecto de la
          aplicación — hasta que llegue no se puede registrar con este campo.
        </p>
      )}
      {error === undefined && !esperandoRequisito && !vacio && ayuda !== undefined && (
        <p className="ayuda" id={idAyuda}>
          {ayuda}
        </p>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ESQUEMA_POR_PESTANA, ETIQUETA_PESTANA } from '@paid/schema';
import type { FilaPestana, PestanaConDatos } from '@paid/schema';
import { ErrorApi, api } from '../../api/cliente';
import { useAnuncio } from '../../api/accesibilidad';
import { Campo } from '../../componentes/Campo';
import { CampoEntidad } from '../../componentes/CampoEntidad';
import { CampoSelector } from '../../componentes/CampoSelector';
import { Alerta, Cruz, Info, Marca, Mas } from '../../componentes/Iconos';
import {
  CAMPOS_DE_ENTIDAD,
  CATALOGO_DE_CAMPO,
  aValorDeEnvio,
  clasificarCampo,
  humanizarCampo,
} from '../campos-pestana';
import type { EsquemaDeCampo } from '../campos-pestana';

/**
 * Una de las diez pestañas de datos.
 *
 * ── Lo que cambió, y por qué ────────────────────────────────────────────────
 *
 * 1. **Lo registrado se ve.** Antes, al pulsar «Añadir registro» la fila
 *    desaparecía del formulario y no quedaba en ninguna parte: no se podía
 *    comprobar lo que se había escrito ni quitar una fila equivocada. Ahora la
 *    tabla de arriba muestra cada fila, con el NOMBRE de lo registrado —no su
 *    número— y un botón para quitarla.
 *
 * 2. **«Añadir y seguir».** El recorrido normal es una fila por pestaña y
 *    pasar a la siguiente. Antes eso eran dos gestos y un vistazo a la rosa
 *    para saber cuál faltaba; ahora es uno, y lleva a la siguiente PENDIENTE,
 *    no a la siguiente de la lista.
 *
 * 3. **Los errores van en su campo.** El servidor devuelve el detalle por
 *    campo, y la pantalla decía solo «Datos inválidos para la pestaña
 *    SERVICIOS_PRESTADOS» — con el nombre interno, además.
 *
 * 4. **Lo obligatorio se marca**, preguntándole al esquema si admite el campo
 *    vacío. Antes no había asterisco en ninguna pestaña.
 *
 * 5. **El Resumen se corrige, no se duplica.** Es uno a uno con la jornada:
 *    si ya existe, el texto aparece para editarlo y el botón dice «Guardar».
 */

export function PanelPestanaDatos({
  idJornada,
  pestana,
  alCambiar,
  siguientePendiente,
  irA,
}: {
  readonly idJornada: number;
  readonly pestana: PestanaConDatos;
  readonly alCambiar: () => void;
  /** La siguiente pestaña sin datos, sin contar esta. `null` si no queda ninguna. */
  readonly siguientePendiente: string | null;
  readonly irA: (pestana: string) => void;
}): JSX.Element {
  const anunciar = useAnuncio();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [aQuitar, setAQuitar] = useState<number | null>(null);
  /*
   * Se incrementa tras cada registro guardado y va en la `key` de los campos.
   * Vaciar el estado no basta: el navegador recuerda que la persona ya tocó el
   * campo y, como es obligatorio y ahora está vacío, `:user-invalid` lo pinta
   * en rojo — un error sobre un formulario que acaba de salir bien.
   */
  const [generacion, setGeneracion] = useState(0);

  const forma = useMemo<Record<string, EsquemaDeCampo>>(() => {
    const esquema = ESQUEMA_POR_PESTANA[pestana];
    return (esquema as unknown as { shape?: Record<string, EsquemaDeCampo> }).shape ?? {};
  }, [pestana]);
  const campos = useMemo(() => Object.keys(forma), [forma]);
  const unoAUno = pestana === 'RESUMEN';

  const filas = useQuery({
    queryKey: ['jornada-filas', idJornada, pestana],
    queryFn: () =>
      api.obtener<readonly FilaPestana[]>(`/jornadas/${idJornada}/pestanas/${pestana}`),
  });

  // El Resumen es uno a uno: si ya existe, se carga para corregirlo.
  const resumenExistente = unoAUno ? filas.data?.[0] : undefined;
  useEffect(() => {
    if (resumenExistente !== undefined) {
      const texto = resumenExistente.campos['texto'];
      setValores({ texto: typeof texto === 'string' ? texto : '' });
    }
  }, [resumenExistente]);

  // Cambiar de pestaña limpia el formulario y los errores de la anterior.
  useEffect(() => {
    setValores({});
    setErrores({});
    setMensaje(null);
    setAQuitar(null);
  }, [pestana]);

  const agregar = useMutation({
    mutationFn: async (seguir: boolean) => {
      const cuerpo: Record<string, unknown> = {};
      for (const [campo, crudo] of Object.entries(valores)) {
        if (crudo.trim() === '') continue;
        cuerpo[campo] = aValorDeEnvio(forma[campo], crudo.trim());
      }
      // Se valida con el MISMO esquema del servidor antes de enviar.
      const validado = ESQUEMA_POR_PESTANA[pestana].safeParse(cuerpo);
      if (!validado.success) {
        const porCampo: Record<string, string> = {};
        for (const problema of validado.error.issues) {
          const clave = String(problema.path[0] ?? '');
          porCampo[clave] ??= mensajeLegible(clave, problema.message);
        }
        setErrores(porCampo);
        throw new Error('validacion');
      }
      await api.crear<{ id: number }>(`/jornadas/${idJornada}/pestanas/${pestana}`, cuerpo);
      return seguir;
    },
    onSuccess: (seguir) => {
      setErrores({});
      setMensaje(null);
      if (!unoAUno) {
        setValores({});
        setGeneracion((g) => g + 1);
      }
      void filas.refetch();
      alCambiar();
      if (seguir && siguientePendiente !== null) {
        anunciar(
          `${ETIQUETA_PESTANA[pestana]}: guardado. Sigue ${nombreDe(siguientePendiente)}.`,
        );
        irA(siguientePendiente);
      } else {
        anunciar(`${ETIQUETA_PESTANA[pestana]}: registro guardado.`);
      }
    },
    onError: (e: unknown) => {
      if (e instanceof Error && e.message === 'validacion') return;
      if (e instanceof ErrorApi) {
        const porCampo: Record<string, string> = {};
        for (const d of e.porCampo) porCampo[d.campo] = mensajeLegible(d.campo, d.mensaje);
        setErrores(porCampo);
        // El servidor nombra la pestaña por su clave interna; aquí, por su
        // rótulo. Y si hay detalle por campo, ese es el mensaje útil.
        setMensaje(
          e.porCampo.length > 0
            ? 'Revise los campos marcados.'
            : e.message.replaceAll(pestana, `«${ETIQUETA_PESTANA[pestana]}»`),
        );
      } else {
        setMensaje('No se pudo guardar el registro.');
      }
    },
  });

  const quitar = useMutation({
    mutationFn: (idFila: number) =>
      api.eliminar<void>(`/jornadas/${idJornada}/pestanas/${pestana}/${idFila}`),
    onSuccess: () => {
      setAQuitar(null);
      void filas.refetch();
      alCambiar();
      anunciar(`${ETIQUETA_PESTANA[pestana]}: registro quitado.`);
    },
    onError: (e: unknown) =>
      setMensaje(e instanceof ErrorApi ? e.message : 'No se pudo quitar el registro.'),
  });

  const registradas = filas.data ?? [];
  const columnas = campos.filter((c) => registradas.some((f) => f.campos[c] !== null));

  return (
    <>
      {/* ── Lo ya registrado ───────────────────────────────────────────── */}
      {filas.isSuccess && registradas.length === 0 && (
        <div className="aviso aviso-ojo">
          <span className="aviso-icono"><Info tamano={17} /></span>
          <p>
            Sin datos todavía. Mientras falte, la jornada <strong>no</strong> entra en los
            consolidados del RAO.
          </p>
        </div>
      )}

      {registradas.length > 0 && !unoAUno && (
        <div className="registradas">
          <p className="rotulo registradas-titulo">
            <Marca tamano={14} /> {registradas.length} registro
            {registradas.length === 1 ? '' : 's'} en esta pestaña
          </p>
          <div className="tabla-envoltura">
            <table className="tabla tabla-compacta">
              <caption className="solo-lectores">
                Registros de la pestaña {ETIQUETA_PESTANA[pestana]}
              </caption>
              <thead>
                <tr>
                  {columnas.map((c) => (
                    <th key={c} scope="col">
                      {humanizarCampo(c)}
                    </th>
                  ))}
                  <th scope="col">
                    <span className="solo-lectores">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {registradas.map((fila) => (
                  <tr key={fila.id}>
                    {columnas.map((c) => (
                      <td
                        key={c}
                        /* Una clave foránea es un número en la base, pero lo que
                           se muestra es su NOMBRE: alinearlo como cifra lo
                           ponía a la derecha y en letra de datos. */
                        className={
                          typeof fila.campos[c] === 'number' && fila.nombres[c] === undefined
                            ? 'num datos'
                            : ''
                        }
                      >
                        {fila.nombres[c] ?? fila.campos[c] ?? '—'}
                      </td>
                    ))}
                    <td className="celda-acciones">
                      {aQuitar === fila.id ? (
                        <span className="fila">
                          <button
                            type="button"
                            className="boton boton-peligro boton-chico"
                            disabled={quitar.isPending}
                            onClick={() => quitar.mutate(fila.id)}
                          >
                            Quitar
                          </button>
                          <button
                            type="button"
                            className="boton boton-fantasma boton-chico"
                            onClick={() => setAQuitar(null)}
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="boton boton-fantasma boton-chico"
                          onClick={() => setAQuitar(fila.id)}
                          aria-label={`Quitar el registro ${fila.nombres[campos[0] ?? ''] ?? fila.id}`}
                        >
                          <Cruz tamano={15} /> Quitar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ayuda">
            Quitar un registro queda en la bitácora con la imagen anterior de la fila.
          </p>
        </div>
      )}

      {mensaje !== null && (
        <div className="aviso aviso-mal" role="alert">
          <span className="aviso-icono"><Alerta tamano={17} /></span>
          <p>{mensaje}</p>
        </div>
      )}

      {/* ── Nuevo registro ─────────────────────────────────────────────── */}
      <p className="rotulo">
        {unoAUno
          ? resumenExistente !== undefined
            ? 'Corregir el resumen'
            : 'Escribir el resumen'
          : registradas.length > 0
            ? 'Añadir otro registro'
            : 'Nuevo registro'}
      </p>

      <div
        key={generacion}
        className={unoAUno ? 'columna panel-campos' : 'rejilla-2 panel-campos'}
      >
        {campos.map((campo) => {
          const fijar = (valor: string): void => setValores((v) => ({ ...v, [campo]: valor }));
          const valor = valores[campo] ?? '';
          const obligatorio = forma[campo]?.safeParse(undefined).success !== true;
          const error = errores[campo];
          const catalogo = CATALOGO_DE_CAMPO[campo];

          /*
           * Un campo que apunta a un catálogo de `ref` es un desplegable, y uno
           * que apunta al maestro de Entidades A.I. es un selector de entidad.
           * Nunca un número: el identificador no aparece en ninguna pantalla.
           */
          if (catalogo !== undefined) {
            return (
              <CampoSelector
                key={campo}
                id={`p-${campo}`}
                rotulo={humanizarCampo(campo)}
                catalogo={catalogo}
                valor={valor}
                obligatorio={obligatorio}
                onCambio={fijar}
                error={error}
              />
            );
          }
          if (CAMPOS_DE_ENTIDAD.includes(campo)) {
            return (
              <CampoEntidad
                key={campo}
                id={`p-${campo}`}
                rotulo={humanizarCampo(campo)}
                valor={valor}
                obligatorio={obligatorio}
                onCambio={fijar}
                error={error}
              />
            );
          }

          const clase = clasificarCampo(forma[campo]);
          return (
            <Campo
              key={campo}
              id={`p-${campo}`}
              rotulo={humanizarCampo(campo)}
              valor={valor}
              onCambio={fijar}
              obligatorio={obligatorio}
              datos={clase !== 'texto'}
              /* El resumen JAD es texto largo; lo demás cabe en una línea. */
              multilinea={campo === 'texto'}
              modo={clase === 'decimal' ? 'decimal' : clase === 'entero' ? 'numeric' : 'text'}
              error={error}
              alPulsarIntro={() => agregar.mutate(true)}
              /* La ayuda dice la verdad de ESE campo: anunciar «el separador
                 decimal es el punto» en un campo entero invita a escribir algo
                 que se va a rechazar. */
              ayuda={
                clase === 'decimal'
                  ? 'Admite decimales. El separador es el punto. Ejemplo: 45.5'
                  : clase === 'entero'
                    ? 'Número entero, sin decimales ni puntos de miles.'
                    : undefined
              }
            />
          );
        })}
      </div>

      <p className="ayuda nota-pendiente">
        TODO(JACID) Q4: los campos definitivos de esta pestaña están por confirmar.
      </p>

      <div className="acciones-pie">
        <div className="fila envolver acciones-botones">
          {!unoAUno && (
            <button
              type="button"
              className="boton boton-secundario"
              disabled={agregar.isPending}
              onClick={() => agregar.mutate(false)}
            >
              <Mas tamano={17} />
              Añadir y agregar otro
            </button>
          )}
          <button
            type="button"
            className="boton boton-primario"
            disabled={agregar.isPending}
            onClick={() => agregar.mutate(true)}
          >
            <Marca tamano={17} />
            {agregar.isPending
              ? 'Guardando…'
              : siguientePendiente === null
                ? unoAUno
                  ? 'Guardar resumen'
                  : 'Añadir registro'
                : `${unoAUno ? 'Guardar' : 'Añadir'} y seguir: ${nombreDe(siguientePendiente)}`}
          </button>
        </div>
      </div>
    </>
  );
}

function nombreDe(pestana: string): string {
  return ETIQUETA_PESTANA[pestana as keyof typeof ETIQUETA_PESTANA] ?? pestana;
}

/**
 * Los mensajes de Zod por omisión están en inglés y hablan de tipos
 * («Invalid input: expected number, received undefined»). Los que el esquema
 * redacta en español se dejan tal cual; los genéricos se traducen a lo que la
 * persona tiene que hacer.
 */
function mensajeLegible(campo: string, mensaje: string): string {
  if (/[áéíóúñ¿]|^[A-ZÁÉÍÓÚ][a-záéíóúñ ]/u.test(mensaje) && !/^Invalid|^Expected/u.test(mensaje)) {
    return mensaje;
  }
  if (campo.startsWith('id')) return 'Elija una opción.';
  if (/received undefined|Required/iu.test(mensaje)) return 'Este dato es obligatorio.';
  return 'Revise este valor.';
}

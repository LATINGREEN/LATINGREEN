import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ETIQUETA_PESTANA,
  PESTANAS_ACTIVIDAD,
  formatearFechaDdMmAaaa,
} from '@paid/schema';
import type {
  EstadoCuota,
  JornadaDetalle,
  PestanaActividad,
  PestanaConDatos,
} from '@paid/schema';
import { ErrorApi, api } from '../api/cliente';
import { useSesion } from '../api/sesion';
import { RosaPestanas } from '../componentes/RosaPestanas';
import { Alerta, Marca } from '../componentes/Iconos';
import { DatosGenerales } from './jornada/DatosGenerales';
import { PanelAdjuntos } from './jornada/PanelAdjuntos';
import { PanelPestanaDatos } from './jornada/PanelPestanaDatos';

/**
 * Una jornada: registrarla, y después diligenciar sus once pestañas.
 *
 * ── Por qué en dos etapas ───────────────────────────────────────────────────
 *
 * Primero los datos generales; al guardarlos, se habilitan las pestañas. Las
 * tablas hijas necesitan el identificador de la actividad, sí, pero la razón
 * de fondo es otra: el clavegrama es lo primero que se tiene, y las once
 * pestañas son la transcripción de lo que ya se escribió ahí. Pedirlo todo de
 * golpe en sesenta campos es el trabajo que B.1 describe como insoportable.
 *
 * ── Lo que esta pantalla hace ahora y antes no ──────────────────────────────
 *
 * - **El clavegrama queda a la vista** mientras se diligencian las pestañas.
 *   Antes, una vez guardada la jornada, no se mostraba: había que volver al
 *   listado para releer lo que se estaba transcribiendo.
 * - **El título es el código de actividad**, no «Jornada 6». El 6 es un
 *   identificador interno que no aparece en ningún documento.
 * - **Los datos generales se pueden corregir**, con el mismo formulario.
 * - **Se abre en la primera pestaña pendiente**, no siempre en la primera.
 *   Quien vuelve a una jornada a medias quiere seguir donde la dejó.
 * - **Cuando se completa, lo dice**, y dice qué significa: entra en el
 *   consolidado del RAO.
 */

export function JornadaFormulario(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const esNueva = id === undefined || id === 'nueva';
  const navegar = useNavigate();

  if (esNueva) {
    return (
      <>
        <div className="pagina-cabecera">
          <div>
            <span className="rotulo">Cooperación Civil Militar · Jornadas de Apoyo</span>
            <h1>Registrar jornada</h1>
            <p className="pagina-descripcion">
              Pegue el clavegrama en la descripción y complete los datos generales. Al
              guardar se genera el código de actividad y se habilitan las once pestañas.
            </p>
          </div>
        </div>
        <Pasos actual={1} />
        <DatosGenerales alGuardar={(r) => navegar(`/jornadas/${r.id}`)} />
      </>
    );
  }

  return <JornadaExistente idJornada={Number(id)} />;
}

function JornadaExistente({ idJornada }: { readonly idJornada: number }): JSX.Element {
  const { puede } = useSesion();
  const clienteConsultas = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState<PestanaActividad | null>(null);

  const detalle = useQuery({
    queryKey: ['jornada', idJornada],
    queryFn: () => api.obtener<JornadaDetalle>(`/jornadas/${idJornada}`),
  });

  const estado = useQuery({
    queryKey: ['jornada-pestanas', idJornada],
    queryFn: () =>
      api.obtener<{
        registroCompleto: boolean;
        faltantes: readonly PestanaActividad[];
        completas: readonly PestanaActividad[];
      }>(`/jornadas/${idJornada}/pestanas`),
  });

  const cuota = useQuery({
    queryKey: ['jornada-cuota', idJornada],
    queryFn: () =>
      api.obtener<EstadoCuota & { cuotaTotalBytes: number }>(
        `/jornadas/${idJornada}/adjuntos/cuota`,
      ),
  });

  const completas = estado.data?.completas ?? [];
  const faltantes = estado.data?.faltantes ?? [];

  // Al abrir, la primera pendiente: quien vuelve a una jornada a medias quiere
  // seguir donde la dejó, no releer desde «Tipo Operación».
  useEffect(() => {
    if (pestanaActiva === null && estado.data !== undefined) {
      setPestanaActiva(estado.data.faltantes[0] ?? 'TIPO_OPERACION');
    }
  }, [estado.data, pestanaActiva]);

  /**
   * Qué caché hay que tirar cuando cambia algo de esta jornada.
   *
   * ⚠️ `['jornadas']` está en la lista y no es de más: al diligenciar la
   * undécima pestaña la jornada pasa a completa, y **el listado es la pantalla
   * por la que se decide qué entra en el consolidado del RAO**. Sin esto
   * seguía diciendo «Faltan 11» durante 30 segundos. Ver D-27.
   */
  const refrescar = useCallback(() => {
    void clienteConsultas.invalidateQueries({ queryKey: ['jornada-pestanas', idJornada] });
    void clienteConsultas.invalidateQueries({ queryKey: ['jornada-cuota', idJornada] });
    void clienteConsultas.invalidateQueries({ queryKey: ['jornada', idJornada] });
    void clienteConsultas.invalidateQueries({ queryKey: ['jornadas'] });
  }, [clienteConsultas, idJornada]);

  if (detalle.isError) {
    const e = detalle.error;
    return (
      <div className="tarjeta vacio">
        <Alerta tamano={30} />
        <h3>{e instanceof ErrorApi && e.estado === 404 ? 'No se encontró la jornada' : 'No se pudo abrir la jornada'}</h3>
        <p>
          {e instanceof ErrorApi && e.estado === 404
            ? 'Puede que no exista o que sea de otra unidad: el sistema responde igual en los dos casos, a propósito.'
            : e instanceof ErrorApi
              ? e.message
              : 'Intente de nuevo.'}
        </p>
        <Link to="/jornadas" className="boton boton-secundario">
          Volver al listado
        </Link>
      </div>
    );
  }

  const d = detalle.data;
  const activa = pestanaActiva ?? 'TIPO_OPERACION';

  /** La siguiente sin datos, en el orden del manual, sin contar la actual. */
  const siguientePendiente = (desde: PestanaActividad): PestanaActividad | null => {
    const orden = PESTANAS_ACTIVIDAD;
    const inicio = orden.indexOf(desde);
    for (let i = 1; i <= orden.length; i += 1) {
      const candidata = orden[(inicio + i) % orden.length];
      if (candidata !== undefined && candidata !== desde && faltantes.includes(candidata)) {
        return candidata;
      }
    }
    return null;
  };
  const irA = (p: string): void => {
    setPestanaActiva(p as PestanaActividad);
    // El foco al panel: quien navega con teclado o lector llega al contenido
    // nuevo en lugar de quedarse en el botón que ya no está.
    window.setTimeout(() => document.getElementById('panel-pestana')?.focus(), 0);
  };

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <span className="rotulo">Cooperación Civil Militar · Jornadas de Apoyo</span>
          <h1 className="datos">{d?.codigoActividad ?? 'Cargando…'}</h1>
          {d !== undefined && (
            <p className="pagina-descripcion">
              {d.lugar}
              {d.municipio !== null && ` · ${d.municipio}`} · ejecutada el{' '}
              {formatearFechaDdMmAaaa(d.fechaEjecucion)} · {d.unidad}
            </p>
          )}
        </div>
        {estado.data !== undefined &&
          (estado.data.registroCompleto ? (
            <span className="distintivo distintivo-completo distintivo-grande">
              <Marca tamano={15} /> Completa
            </span>
          ) : (
            <span className="distintivo distintivo-incompleto distintivo-grande">
              Faltan {faltantes.length} de 11
            </span>
          ))}
      </div>

      <Pasos actual={estado.data?.registroCompleto === true ? 3 : 2} />

      {estado.data?.registroCompleto === true && (
        <div className="aviso aviso-bien aviso-destacado" role="status">
          <span className="aviso-icono"><Marca tamano={20} /></span>
          <div>
            <p>
              <strong>Jornada completa.</strong> Las once pestañas tienen datos, así que
              entra en los consolidados del RAO.
            </p>
            <p className="ayuda">
              Puede seguir corrigiendo cualquier pestaña. Si quita la última fila de una,
              la jornada vuelve a quedar incompleta y sale del consolidado.
            </p>
          </div>
          <Link to="/jornadas" className="boton boton-secundario">
            Volver al listado
          </Link>
        </div>
      )}

      {/* ── El clavegrama, a la vista ───────────────────────────────────── */}
      {d !== undefined && !editando && (
        <details className="clavegrama tarjeta" open>
          <summary>
            <span className="rotulo">Clavegrama y datos generales</span>
            <span className="clavegrama-pista">de aquí salen las once pestañas</span>
          </summary>
          <div className="clavegrama-cuerpo">
            <p className="clavegrama-texto">{d.descripcion}</p>
            <dl className="clavegrama-datos">
              <div>
                <dt>Inicio</dt>
                <dd className="datos">{formatearFechaDdMmAaaa(d.fechaInicio)}</dd>
              </div>
              <div>
                <dt>Ejecución</dt>
                <dd className="datos">{formatearFechaDdMmAaaa(d.fechaEjecucion)}</dd>
              </div>
              {d.fechaFin !== null && (
                <div>
                  <dt>Finalización</dt>
                  <dd className="datos">{formatearFechaDdMmAaaa(d.fechaFin)}</dd>
                </div>
              )}
              <div>
                <dt>Coordenadas</dt>
                <dd className="datos">
                  {d.latitudDecimal.toFixed(6)}, {d.longitudDecimal.toFixed(6)}
                </dd>
              </div>
              <div>
                <dt>COAMI</dt>
                <dd>{d.coami.length === 0 ? 'Ninguno' : d.coami.join(', ')}</dd>
              </div>
            </dl>
            {d.observaciones !== null && d.observaciones !== '' && (
              <p className="ayuda">
                <strong>Observaciones:</strong> {d.observaciones}
              </p>
            )}
            {puede('JORNADA.EDITAR') && (
              <button
                type="button"
                className="boton boton-secundario"
                onClick={() => setEditando(true)}
              >
                Corregir datos generales
              </button>
            )}
          </div>
        </details>
      )}

      {d !== undefined && editando && (
        <DatosGenerales
          inicial={d}
          alGuardar={() => {
            setEditando(false);
            refrescar();
          }}
          alCancelar={() => setEditando(false)}
        />
      )}

      {/* ── Las once pestañas ───────────────────────────────────────────── */}
      {!editando && (
        <div className="pestanas">
          <nav className="pestanas-rosa" aria-label="Pestañas de la jornada">
            <RosaPestanas
              completas={completas}
              tamano="grande"
              pestanaActiva={activa}
              onElegir={irA}
            />
            <ul className="pestanas-lista">
              {PESTANAS_ACTIVIDAD.map((pestana, indice) => {
                const lista = completas.includes(pestana);
                return (
                  <li key={pestana}>
                    <button
                      type="button"
                      className={`pestanas-enlace ${activa === pestana ? 'es-activa' : ''}`}
                      /* Las pruebas navegan por este atributo y no por el
                         rótulo, que es texto para personas y puede cambiar. */
                      data-pestana={pestana}
                      onClick={() => irA(pestana)}
                      aria-current={activa === pestana ? 'step' : undefined}
                    >
                      <span
                        className={`pestanas-marca ${lista ? 'es-lista' : ''}`}
                        aria-hidden="true"
                      >
                        {lista ? null : <span className="pestanas-numero">{indice + 1}</span>}
                      </span>
                      <span>{ETIQUETA_PESTANA[pestana]}</span>
                      <span className="solo-lectores">
                        {lista ? '. Con datos.' : '. Sin datos.'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <section
            className="pestanas-panel tarjeta"
            id="panel-pestana"
            tabIndex={-1}
            aria-labelledby="titulo-pestana"
            key={activa}
          >
            <div className="fila-sep">
              <h2 id="titulo-pestana">
                <span className="pestanas-posicion datos">
                  {PESTANAS_ACTIVIDAD.indexOf(activa) + 1}/11
                </span>{' '}
                {ETIQUETA_PESTANA[activa]}
              </h2>
              {completas.includes(activa) && (
                <span className="distintivo distintivo-completo">
                  <Marca tamano={13} /> Con datos
                </span>
              )}
            </div>

            {activa === 'ARCHIVOS_ADJUNTOS' ? (
              <PanelAdjuntos
                idJornada={idJornada}
                cuota={cuota.data}
                puedeCargar={puede('ADJUNTO.CARGAR')}
                alCambiar={refrescar}
                siguientePendiente={siguientePendiente(activa)}
                irA={irA}
              />
            ) : (
              <PanelPestanaDatos
                idJornada={idJornada}
                pestana={activa as PestanaConDatos}
                alCambiar={refrescar}
                siguientePendiente={siguientePendiente(activa)}
                irA={irA}
              />
            )}
          </section>
        </div>
      )}
    </>
  );
}

/**
 * Dónde está la persona en el recorrido de tres pasos. Es texto y no solo
 * forma: el paso actual se anuncia con `aria-current="step"`.
 */
function Pasos({ actual }: { readonly actual: 1 | 2 | 3 }): JSX.Element {
  const pasos = ['Datos generales', 'Once pestañas', 'Completa: entra al RAO'];
  return (
    <ol className="pasos" aria-label="Progreso del registro">
      {pasos.map((rotulo, i) => {
        const numero = i + 1;
        const estado = numero < actual ? 'hecho' : numero === actual ? 'actual' : 'pendiente';
        return (
          <li
            key={rotulo}
            className={`paso paso-${estado}`}
            aria-current={estado === 'actual' ? 'step' : undefined}
          >
            <span className="paso-numero" aria-hidden="true">
              {estado === 'hecho' ? <Marca tamano={13} /> : numero}
            </span>
            <span>{rotulo}</span>
            {estado === 'hecho' && <span className="solo-lectores"> (hecho)</span>}
          </li>
        );
      })}
    </ol>
  );
}

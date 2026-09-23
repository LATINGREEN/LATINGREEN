import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ETIQUETA_PESTANA, formatearFechaDdMmAaaa } from '@paid/schema';
import type { JornadaEnListado, PestanaActividad } from '@paid/schema';
import { ErrorApi, api, descargarArchivo } from '../api/cliente';
import { useSesion } from '../api/sesion';
import { useAnuncio } from '../api/accesibilidad';
import { RosaPestanas } from '../componentes/RosaPestanas';
import { TablaEnvoltura } from '../componentes/TablaEnvoltura';
import { Alerta, Descargar, Lupa, Mas } from '../componentes/Iconos';

/**
 * Listado de Jornadas de Apoyo.
 *
 * R19 — «El listado señala visualmente los registros incompletos.» Eso se hace
 * con la Rosa de Pestañas en cada fila: once segmentos, los que faltan
 * apagados. Y además con un distintivo con TEXTO, porque el color no puede
 * llevar la información solo.
 *
 * La columna «Registro completo» no es cosmética: es por la que filtran los
 * consolidados del RAO. Un registro incompleto no sale en el consolidado, y
 * hoy nadie se enteraría. Por eso el filtro «Solo completas» dice, en su
 * propia ayuda, qué significa.
 */
export function Jornadas(): JSX.Element {
  const { puede } = useSesion();
  const anunciar = useAnuncio();
  const [texto, setTexto] = useState('');
  const [soloCompletas, setSoloCompletas] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const listado = useQuery({
    queryKey: ['jornadas', busqueda, soloCompletas],
    queryFn: () => {
      const parametros = new URLSearchParams({ porPagina: '50', pagina: '1' });
      if (busqueda !== '') parametros.set('texto', busqueda);
      if (soloCompletas) parametros.set('soloCompletas', 'true');
      return api.obtener<{ filas: JornadaEnListado[]; total: number }>(
        `/jornadas?${parametros.toString()}`,
      );
    },
  });

  const exportar = useMutation({
    mutationFn: async (formato: 'xlsx' | 'csv') => {
      const parametros = new URLSearchParams({ porPagina: '500', pagina: '1' });
      if (busqueda !== '') parametros.set('texto', busqueda);
      if (soloCompletas) parametros.set('soloCompletas', 'true');
      const contenido = await api.descargar(
        `/jornadas/exportacion/${formato}?${parametros.toString()}`,
      );
      const marca = new Date().toISOString().slice(0, 10);
      descargarArchivo(contenido, `jornadas-${marca}.${formato}`);
      return formato;
    },
    onSuccess: (formato) => anunciar(`Exportación ${formato.toUpperCase()} descargada.`),
  });

  const filas = listado.data?.filas ?? [];

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <span className="rotulo">Cooperación Civil Militar</span>
          <h1>Jornadas de Apoyo al Desarrollo</h1>
          <p className="pagina-descripcion">
            Cada jornada exige <strong>once pestañas</strong> diligenciadas. La rosa de
            cada fila muestra cuántas tienen datos; solo las completas entran en los
            consolidados del RAO.
          </p>
        </div>
        {puede('JORNADA.CREAR') && (
          <Link to="/jornadas/nueva" className="boton boton-primario">
            <Mas tamano={18} />
            Registrar jornada
          </Link>
        )}
      </div>

      <div className="filtros tarjeta">
        <div className="campo crecer">
          <label htmlFor="buscar">Buscar por código o descripción</label>
          <div className="buscador">
            <input
              id="buscar"
              className="entrada"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setBusqueda(texto.trim());
              }}
              placeholder="Por ejemplo: raciones, o 2813304R32026"
            />
            <button
              type="button"
              className="boton boton-secundario"
              onClick={() => setBusqueda(texto.trim())}
            >
              <Lupa tamano={17} />
              Buscar
            </button>
          </div>
        </div>

        <div className="campo">
          <label htmlFor="solo-completas">Consolidado</label>
          <label className="interruptor">
            <input
              id="solo-completas"
              type="checkbox"
              checked={soloCompletas}
              onChange={(e) => setSoloCompletas(e.target.checked)}
            />
            <span className="interruptor-pista" aria-hidden="true" />
            <span>Solo completas</span>
          </label>
          <p className="ayuda">Es el filtro que usan los consolidados del RAO.</p>
        </div>

        {puede('EXPORTACION.GENERAR') && (
          <div className="campo">
            <span className="campo-rotulo-falso">Exportar</span>
            <div className="fila">
              <button
                type="button"
                className="boton boton-secundario"
                disabled={exportar.isPending}
                onClick={() => exportar.mutate('xlsx')}
              >
                <Descargar tamano={17} />
                XLSX
              </button>
              <button
                type="button"
                className="boton boton-secundario"
                disabled={exportar.isPending}
                onClick={() => exportar.mutate('csv')}
              >
                <Descargar tamano={17} />
                CSV
              </button>
            </div>
            <p className="ayuda">Cada exportación queda registrada.</p>
          </div>
        )}
      </div>

      {listado.isError && (
        <div className="aviso aviso-mal" role="alert">
          <span className="aviso-icono"><Alerta tamano={18} /></span>
          <div>
            <p>
              {listado.error instanceof ErrorApi
                ? listado.error.message
                : 'No se pudo cargar el listado.'}
            </p>
            {listado.error instanceof ErrorApi && listado.error.idCorrelacion !== '' && (
              <p className="ayuda">
                Identificador para reportar: <code>{listado.error.idCorrelacion}</code>
              </p>
            )}
          </div>
        </div>
      )}

      {listado.isPending && (
        <div className="tabla-envoltura" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="esqueleto" style={{ height: '3.2rem', margin: '1px' }} />
          ))}
        </div>
      )}

      {listado.isSuccess && filas.length === 0 && (
        <div className="tarjeta vacio">
          <h3>Todavía no hay jornadas registradas</h3>
          <p>
            {busqueda !== '' || soloCompletas
              ? 'Ninguna jornada coincide con el filtro. Pruebe a limpiarlo.'
              : 'Antes de registrar una jornada deben existir Personal, Entidades A.I. y Herramientas AID: son los tres maestros de precedencia.'}
          </p>
          {puede('JORNADA.CREAR') && busqueda === '' && !soloCompletas && (
            <Link to="/jornadas/nueva" className="boton boton-primario">
              <Mas tamano={18} />
              Registrar la primera
            </Link>
          )}
        </div>
      )}

      {listado.isSuccess && filas.length > 0 && (
        <>
          <p className="conteo">
            {listado.data.total} jornada{listado.data.total === 1 ? '' : 's'}
            {soloCompletas ? ' completas' : ''}
            {' · '}
            {filas.filter((f) => !f.registroCompleto).length} sin terminar
          </p>

          <TablaEnvoltura nombre="Jornadas de apoyo al desarrollo">
            <table className="tabla">
              <caption className="solo-lectores">
                Jornadas de apoyo al desarrollo. La columna «Pestañas» indica cuántas
                de las once tienen datos.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Pestañas</th>
                  <th scope="col">Código</th>
                  <th scope="col">Ejecución</th>
                  <th scope="col">Lugar</th>
                  <th scope="col">Municipio</th>
                  <th scope="col">Coordenadas</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody className="escalonado">
                {filas.map((fila) => {
                  const completas = (
                    Object.keys(ETIQUETA_PESTANA) as PestanaActividad[]
                  ).filter((p) => !fila.pestanasFaltantes.includes(p));
                  return (
                    <tr key={fila.id}>
                      <td>
                        <RosaPestanas completas={completas} />
                      </td>
                      <td>
                        <Link to={`/jornadas/${fila.id}`} className="datos enlace-codigo">
                          {fila.codigoActividad}
                        </Link>
                        <p className="celda-sub">{fila.unidad}</p>
                      </td>
                      <td className="datos">{formatearFechaDdMmAaaa(fila.fechaEjecucion)}</td>
                      <td>
                        <span className="celda-lugar">{fila.lugar}</span>
                        <p className="celda-sub celda-clavegrama">{fila.descripcion}</p>
                      </td>
                      <td>{fila.municipio ?? <span className="celda-sub">—</span>}</td>
                      <td className="datos celda-coord">
                        {fila.latitudDecimal.toFixed(4)}
                        <br />
                        {fila.longitudDecimal.toFixed(4)}
                      </td>
                      <td>
                        {fila.registroCompleto ? (
                          <span className="distintivo distintivo-completo">Completo</span>
                        ) : (
                          /* Un enlace y no solo un distintivo: lo que se hace con
                             una jornada incompleta es seguir diligenciándola, y
                             el formulario abre en la primera pestaña pendiente. */
                          <Link
                            to={`/jornadas/${fila.id}`}
                            className="distintivo distintivo-incompleto enlace-continuar"
                            title={fila.pestanasFaltantes
                              .map((p) => ETIQUETA_PESTANA[p as PestanaActividad])
                              .join(', ')}
                            aria-label={`Continuar ${fila.codigoActividad}: faltan ${fila.pestanasFaltantes.length} pestañas`}
                          >
                            Faltan {fila.pestanasFaltantes.length} · Continuar →
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TablaEnvoltura>
        </>
      )}
    </>
  );
}

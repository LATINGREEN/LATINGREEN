import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatearFechaDdMmAaaa } from '@paid/schema';
import type { NormatividadEnListado } from '@paid/schema';
import { ErrorApi, api } from '../api/cliente';
import { useSesion } from '../api/sesion';
import { Alerta, Info, Libro, Lupa } from '../componentes/Iconos';

/**
 * Normatividad A.I. — la última entrada del menú del manual.
 *
 * Solo lectura. La carga de documentos exige `NORMATIVIDAD.CARGAR`, que R16
 * reserva a JACID, y pasa por el camino de adjuntos que R12 gobierna. Está
 * pendiente de Q15: R11 fija una cuota de 10 MB «por actividad», y la
 * normatividad no es una actividad — no está escrito si tiene cuota ni cuál.
 * No se rellena con un supuesto.
 *
 * Se presenta como fichas y no como tabla: son documentos que se leen, y de
 * cada uno importa el título completo, no una celda recortada.
 */

interface Listado {
  readonly filas: readonly NormatividadEnListado[];
  readonly total: number;
}

export function Normatividad(): JSX.Element {
  const { puede } = useSesion();
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const listado = useQuery({
    queryKey: ['normatividad', busqueda],
    queryFn: () =>
      api.obtener<Listado>(
        `/normatividad${busqueda === '' ? '' : `?texto=${encodeURIComponent(busqueda)}`}`,
      ),
  });

  const filas = listado.data?.filas ?? [];

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <span className="rotulo">Marco normativo</span>
          <h1>Normatividad A.I.</h1>
          <p className="pagina-descripcion">
            Directivas, resoluciones y manuales que rigen la acción integral. Son
            institucionales: las ve toda la Fuerza, no solo su unidad.
          </p>
        </div>
      </div>

      {puede('NORMATIVIDAD.CARGAR') && (
        <div className="aviso aviso-info">
          <span className="aviso-icono">
            <Info tamano={18} />
          </span>
          <p>
            Su credencial puede cargar normatividad, pero la carga todavía no está
            habilitada: falta definir si estos documentos comparten la cuota de 10 MB
            de las actividades o tienen la suya. Está anotado como pregunta a JACID.
          </p>
        </div>
      )}

      <div className="filtros tarjeta">
        <div className="campo crecer">
          <label htmlFor="buscar-norma">Buscar por título o número</label>
          <div className="buscador">
            <input
              id="buscar-norma"
              className="entrada"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setBusqueda(texto.trim());
              }}
              placeholder="Por ejemplo: acción integral, o 0234"
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
      </div>

      {listado.isError && (
        <div className="aviso aviso-mal" role="alert">
          <span className="aviso-icono">
            <Alerta tamano={18} />
          </span>
          <p>
            {listado.error instanceof ErrorApi
              ? listado.error.message
              : 'No se pudo cargar la normatividad.'}
          </p>
        </div>
      )}

      {listado.isSuccess && filas.length === 0 && (
        <div className="tarjeta vacio">
          <Libro tamano={34} />
          <h3>
            {busqueda === '' ? 'No hay normatividad cargada' : 'Ninguna norma coincide'}
          </h3>
          <p>
            {busqueda === ''
              ? 'La carga la hace JACID: el permiso está reservado, porque un documento normativo equivocado orienta mal a toda la Fuerza.'
              : 'Pruebe con una palabra del título.'}
          </p>
        </div>
      )}

      {listado.isSuccess && filas.length > 0 && (
        <>
          <p className="conteo">
            {listado.data.total} documento{listado.data.total === 1 ? '' : 's'}
          </p>
          <div className="fichas escalonado">
            {filas.map((fila) => (
              <article key={fila.id} className="tarjeta ficha">
                <span className="rotulo">
                  {fila.tipo} {fila.numero} de {fila.anio}
                </span>
                <h3>{fila.titulo}</h3>
                {fila.expedidaPor !== null && (
                  <p className="ficha-cuerpo">{fila.expedidaPor}</p>
                )}
                <div className="ficha-pie">
                  <span className="datos">
                    Expedida el {formatearFechaDdMmAaaa(fila.fechaExpedicion)}
                  </span>
                  {fila.tieneArchivo ? (
                    <span className="distintivo distintivo-completo">Con archivo</span>
                  ) : (
                    <span className="distintivo distintivo-neutro">Sin archivo</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}

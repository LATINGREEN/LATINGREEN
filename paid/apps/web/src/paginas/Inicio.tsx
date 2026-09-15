import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CANTIDAD_PESTANAS,
  MAESTROS_DE_PRECEDENCIA,
  TRAMOS_AVANCE,
  TRAMOS_INEXISTENTES,
} from '@paid/schema';
import {
  ETIQUETA_PESTANA,
} from '@paid/schema';
import type { JornadaEnListado, PestanaActividad } from '@paid/schema';
import { api } from '../api/cliente';
import { useSesion } from '../api/sesion';
import { RosaPestanas } from '../componentes/RosaPestanas';
import { TablaEnvoltura } from '../componentes/TablaEnvoltura';
import { Alerta, Info, Mas } from '../componentes/Iconos';

/**
 * Inicio.
 *
 * No es una bienvenida: es un parte de estado. PROMPT.md cierra con una
 * advertencia —«el defecto característico de este sistema no es que falle: es
 * que parezca funcionar mientras acumula datos que no cuadran»— y esta
 * pantalla existe para contradecirla. Lo primero que se ve al entrar es
 * cuántas jornadas están incompletas, porque una jornada incompleta no entra
 * en los consolidados del RAO y hoy nadie se enteraría.
 *
 * Por eso el indicador de «sin terminar» es el grande y va primero, aunque un
 * tablero convencional pondría el total. El total no es actuable; lo que falta,
 * sí.
 */

interface Listado {
  readonly filas: readonly JornadaEnListado[];
  readonly total: number;
}

export function Inicio(): JSX.Element {
  const { sesion, puede } = useSesion();

  const jornadas = useQuery({
    queryKey: ['jornadas', '', false],
    queryFn: () => api.obtener<Listado>('/jornadas?porPagina=50&pagina=1'),
    enabled: puede('JORNADA.CONSULTAR'),
  });

  const filas = jornadas.data?.filas ?? [];
  const incompletas = filas.filter((f) => !f.registroCompleto);
  const pestanasFaltantes = incompletas.reduce((suma, f) => suma + f.pestanasFaltantes.length, 0);

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <span className="rotulo">Puente de mando</span>
          <h1>
            {sesion?.unidad.sigla ?? 'PAID'} · Acción Integral
          </h1>
          <p className="pagina-descripcion">
            {sesion?.unidad.nombre ?? ''}. Lo que ve aquí es lo que su unidad alcanza:
            el aislamiento por unidad lo aplica la base de datos, no esta pantalla.
          </p>
        </div>
        {puede('JORNADA.CREAR') && (
          <Link to="/jornadas/nueva" className="boton boton-primario">
            <Mas tamano={18} />
            Registrar jornada
          </Link>
        )}
      </div>

      {puede('JORNADA.CONSULTAR') && (
        <>
          <h2 className="solo-lectores">Estado del registro</h2>
          <div className="tablero escalonado">
            <article
              className={`tarjeta indicador ${
                incompletas.length === 0 ? 'indicador-bien' : 'indicador-mal'
              }`}
            >
              <span className="rotulo">Jornadas sin terminar</span>
              <span className="indicador-cifra">
                {jornadas.isPending ? '—' : incompletas.length}
              </span>
              <span className="indicador-nota">
                {incompletas.length === 0
                  ? 'Todas las jornadas visibles tienen las once pestañas.'
                  : `Quedan ${pestanasFaltantes} pestañas por diligenciar. Ninguna de estas jornadas entra en los consolidados del RAO.`}
              </span>
            </article>

            <article className="tarjeta indicador">
              <span className="rotulo">Jornadas registradas</span>
              <span className="indicador-cifra">
                {jornadas.isPending ? '—' : (jornadas.data?.total ?? 0)}
              </span>
              <span className="indicador-nota">En el ámbito de {sesion?.unidad.sigla ?? '—'}.</span>
            </article>

            <article className="tarjeta indicador indicador-bien">
              <span className="rotulo">Completas</span>
              <span className="indicador-cifra">
                {jornadas.isPending ? '—' : filas.length - incompletas.length}
              </span>
              <span className="indicador-nota">Cuentan para el consolidado.</span>
            </article>

            <article className="tarjeta indicador indicador-ojo">
              <span className="rotulo">Pestañas por jornada</span>
              <span className="indicador-cifra">{CANTIDAD_PESTANAS}</span>
              <span className="indicador-nota">
                Todas obligatorias para que el registro se considere completo.
              </span>
            </article>
          </div>

          {incompletas.length > 0 && (
            <section aria-labelledby="titulo-pendientes" style={{ marginTop: 'var(--e-6)' }}>
              <h2 id="titulo-pendientes">Le faltan pestañas</h2>
              <p className="conteo">
                Las {Math.min(6, incompletas.length)} más recientes. La rosa muestra
                cuántas de las once tienen datos.
              </p>
              <TablaEnvoltura nombre="Jornadas a las que les faltan pestañas">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th scope="col">Pestañas</th>
                      <th scope="col">Código</th>
                      <th scope="col">Lugar</th>
                      <th scope="col">Faltan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incompletas.slice(0, 6).map((fila) => (
                      <tr key={fila.id}>
                        <td>
                          <RosaPestanas completas={completasDe(fila)} />
                        </td>
                        <td>
                          <Link to={`/jornadas/${fila.id}`} className="datos enlace-codigo">
                            {fila.codigoActividad}
                          </Link>
                        </td>
                        <td>{fila.lugar}</td>
                        <td>
                          <span className="distintivo distintivo-incompleto">
                            Faltan {fila.pestanasFaltantes.length}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TablaEnvoltura>
            </section>
          )}
        </>
      )}

      {!puede('JORNADA.CONSULTAR') && (
        <div className="aviso aviso-info">
          <span className="aviso-icono">
            <Info tamano={18} />
          </span>
          <p>
            Su credencial no tiene permiso para consultar jornadas, así que el parte de
            estado no aplica. El menú solo muestra lo que puede usar.
          </p>
        </div>
      )}

      <section aria-labelledby="titulo-orden" style={{ marginTop: 'var(--e-6)' }}>
        <h2 id="titulo-orden">Antes de registrar una actividad</h2>
        <p className="pagina-descripcion">
          Los tres maestros de precedencia deben existir. No es una recomendación: la
          base de datos rechaza la actividad si falta cualquiera de ellos.
        </p>
        <ol className="rejilla-2" style={{ listStyle: 'none', padding: 0, margin: 'var(--e-4) 0 0' }}>
          {MAESTROS_DE_PRECEDENCIA.map((maestro, indice) => (
            <li key={maestro} className="tarjeta ficha">
              <span className="rotulo">Maestro {indice + 1} de 3</span>
              <h3>{ETIQUETA_MAESTRO[maestro]}</h3>
              <p className="ficha-cuerpo">{AYUDA_MAESTRO[maestro]}</p>
              <div className="ficha-pie">
                <Link to={RUTA_MAESTRO[maestro]} className="boton boton-secundario">
                  Abrir
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="titulo-escala" style={{ marginTop: 'var(--e-6)' }}>
        <h2 id="titulo-escala">Escala de avance de proyectos</h2>
        <p className="pagina-descripcion">
          Son ocho tramos y solo se puede avanzar, nunca retroceder.{' '}
          <strong>80 y 90 no existen</strong>: la base rechaza esos valores, y esta
          pantalla los muestra tachados para que quede claro que faltan a propósito.
        </p>
        <ul className="escala" style={{ marginTop: 'var(--e-4)' }}>
          {TRAMOS_AVANCE.slice(0, 7).map((tramo) => (
            <li key={tramo} className="escala-tramo">
              {tramo}%
            </li>
          ))}
          {TRAMOS_INEXISTENTES.map((inexistente) => (
            <li key={inexistente} className="escala-hueco">
              <span aria-hidden="true">{inexistente}%</span>
              <span className="solo-lectores">
                {inexistente} por ciento no existe en la escala
              </span>
            </li>
          ))}
          <li className="escala-tramo es-cierre">100%</li>
        </ul>
      </section>

      <div className="aviso aviso-ojo" style={{ marginTop: 'var(--e-6)' }}>
        <span className="aviso-icono">
          <Alerta tamano={18} />
        </span>
        <p>
          <strong>Información Público Clasificado.</strong> La plataforma opera solo en
          la Intranet ARC. No exporte ni reenvíe estos datos por fuera de la red
          institucional.
        </p>
      </div>
    </>
  );
}

const ETIQUETA_MAESTRO: Record<(typeof MAESTROS_DE_PRECEDENCIA)[number], string> = {
  PERSONAL: 'Tripulantes A.I.',
  ENTIDAD_AI: 'Entidades A.I.',
  HERRAMIENTA_AID: 'Herramientas AID',
};

const RUTA_MAESTRO: Record<(typeof MAESTROS_DE_PRECEDENCIA)[number], string> = {
  PERSONAL: '/tripulantes',
  ENTIDAD_AI: '/entidades',
  HERRAMIENTA_AID: '/herramientas',
};

const AYUDA_MAESTRO: Record<(typeof MAESTROS_DE_PRECEDENCIA)[number], string> = {
  PERSONAL:
    'El personal que ejecuta. El mismo número de documento con distinto tipo son dos personas; con el mismo tipo, es un error de digitación y la base lo rechaza.',
  ENTIDAD_AI:
    'Las entidades apoyadas. Antes de guardar se buscan nombres parecidos: una entidad registrada dos veces reparte entre las dos lo que debía ir junto.',
  HERRAMIENTA_AID:
    'Las herramientas de Acción Integral y Desarrollo. Capturan coordenadas aunque no sean actividades: es el formulario georreferenciado que se olvida.',
};

/**
 * Las pestañas que YA tienen datos, deducidas de las que faltan.
 *
 * El listado devuelve `pestanasFaltantes` y la rosa recibe `completas`: la
 * conversión se hace en un solo sitio porque invertirla mal pinta la rosa al
 * revés —verde donde falta— y eso es peor que no pintarla.
 */
function completasDe(fila: JornadaEnListado): readonly PestanaActividad[] {
  const faltan = new Set(fila.pestanasFaltantes);
  return (Object.keys(ETIQUETA_PESTANA) as PestanaActividad[]).filter((p) => !faltan.has(p));
}

import { NavLink, Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useSesion } from '../api/sesion';
import { ControlesAccesibilidad } from './ControlesAccesibilidad';
import { RelojSesion } from './RelojSesion';
import {
  Ancla,
  Brujula,
  Edificio,
  Herramienta,
  Libro,
  Manos,
  Megafono,
  Personas,
  Salir,
} from './Iconos';

/**
 * El marco de la aplicación: «puente de mando».
 *
 * MENÚ FIEL AL MANUAL (Fase 4, punto 2):
 *
 *   Inicio · Tripulantes A.I. · Cooperación Civil Militar · Asuntos Civiles ·
 *   Sensibilización · Normatividad A.I.
 *
 * Y la segunda mitad de ese punto, que es la que importa: «Lo que no se tiene
 * permiso de usar no se muestra». No se muestra deshabilitado ni con un
 * candado: no aparece. Un menú lleno de opciones que dan 403 enseña al usuario
 * a ignorar los mensajes de error.
 *
 * El permiso se comprueba contra los permisos EFECTIVOS que el servidor
 * devolvió al ingresar. La interfaz oculta; el servidor prohíbe. Las dos cosas
 * —si solo ocultara, bastaría con escribir la URL.
 */

interface Entrada {
  readonly a: string;
  readonly rotulo: string;
  readonly icono: ReactNode;
  /** Permiso que hace visible la entrada. Sin permiso, no se muestra. */
  readonly permiso?: string;
  readonly hijas?: readonly Omit<Entrada, 'icono'>[];
}

const MENU: readonly Entrada[] = [
  { a: '/', rotulo: 'Inicio', icono: <Brujula /> },
  {
    a: '/tripulantes',
    rotulo: 'Tripulantes A.I.',
    icono: <Personas />,
    permiso: 'PERSONAL.CONSULTAR',
  },
  {
    a: '/cooperacion',
    rotulo: 'Cooperación Civil Militar',
    icono: <Manos />,
    permiso: 'JORNADA.CONSULTAR',
    hijas: [
      { a: '/jornadas', rotulo: 'Jornadas de Apoyo', permiso: 'JORNADA.CONSULTAR' },
      { a: '/entidades', rotulo: 'Entidades A.I.', permiso: 'ENTIDAD.CONSULTAR' },
      { a: '/alianzas', rotulo: 'Alianzas y convenios', permiso: 'ALIANZA.CONSULTAR' },
    ],
  },
  {
    a: '/asuntos-civiles',
    rotulo: 'Asuntos Civiles',
    icono: <Edificio />,
    permiso: 'ASISTENCIA.CONSULTAR',
  },
  {
    a: '/sensibilizacion',
    rotulo: 'Sensibilización',
    icono: <Megafono />,
    permiso: 'CAMPANA.CONSULTAR',
  },
  {
    a: '/herramientas',
    rotulo: 'Herramientas AID',
    icono: <Herramienta />,
    permiso: 'HERRAMIENTA.CONSULTAR',
  },
  {
    a: '/normatividad',
    rotulo: 'Normatividad A.I.',
    icono: <Libro />,
    permiso: 'NORMATIVIDAD.CONSULTAR',
  },
];

export function Marco(): JSX.Element {
  const { sesion, salir, puede } = useSesion();
  if (sesion === null) return <Outlet />;

  const visibles = MENU.filter((e) => e.permiso === undefined || puede(e.permiso));

  return (
    <div className="marco">
      <a className="salto-contenido" href="#contenido">
        Saltar al contenido
      </a>

      <header className="barra">
        <div className="barra-marca">
          <span className="barra-ancla" aria-hidden="true">
            <Ancla tamano={22} />
          </span>
          <div>
            <p className="barra-titulo">PAID</p>
            <p className="barra-sub">Acción Integral y Desarrollo</p>
          </div>
        </div>

        <div className="barra-derecha">
          <RelojSesion />
          <ControlesAccesibilidad />
          <div className="barra-usuario">
            <p className="barra-credencial datos">{sesion.credencial}</p>
            <p className="barra-unidad">
              {sesion.unidad.sigla} · {sesion.roles.join(', ')}
            </p>
          </div>
          <button
            type="button"
            className="boton boton-fantasma"
            onClick={() => void salir()}
          >
            <Salir tamano={17} />
            <span className="oculta-angosto">Cerrar sesión</span>
          </button>
        </div>
      </header>

      <div className="cuerpo">
        <nav className="riel" aria-label="Menú principal">
          <ul className="riel-lista">
            {visibles.map((entrada) => {
              const hijas = (entrada.hijas ?? []).filter(
                (h) => h.permiso === undefined || puede(h.permiso),
              );
              return (
                <li key={entrada.a}>
                  <NavLink
                    to={hijas.length > 0 ? (hijas[0]?.a ?? entrada.a) : entrada.a}
                    end={entrada.a === '/'}
                    className={({ isActive }) => `riel-enlace ${isActive ? 'es-activo' : ''}`}
                  >
                    <span className="riel-icono">{entrada.icono}</span>
                    <span>{entrada.rotulo}</span>
                  </NavLink>
                  {hijas.length > 0 && (
                    <ul className="riel-hijas">
                      {hijas.map((hija) => (
                        <li key={hija.a}>
                          <NavLink
                            to={hija.a}
                            className={({ isActive }) =>
                              `riel-hija ${isActive ? 'es-activo' : ''}`
                            }
                          >
                            {hija.rotulo}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="riel-pie">
            Intranet ARC · sin salida a internet
            <br />
            Información Público Clasificado
          </p>
        </nav>

        <main className="contenido" id="contenido" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      {/* Región para anuncios de lector de pantalla. Una sola, viva siempre:
          crearla al momento de anunciar no funciona, el lector no la observa. */}
      <div id="anuncios" className="solo-lectores" role="status" aria-live="polite" />
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSesion } from '../api/sesion';
import { ControlesAccesibilidad } from './ControlesAccesibilidad';
import { EmblemaJacid, LogotipoArmada } from './Emblemas';
import { PieInstitucional } from './PieInstitucional';
import { RelojSesion } from './RelojSesion';
import { Flecha, Usuario } from './Iconos';

/**
 * El marco de la aplicación, como lo muestra el Manual del Usuario PAID
 * (láminas 11 y 12):
 *
 *   barra GOV.CO · cabecera azul con «Ministerio de Defensa Nacional», el
 *   título PAID con el emblema de la JACID y el logotipo de la Armada · menú
 *   horizontal con desplegables · línea dorada · contenido · pie azul con los
 *   datos de la Jefatura · barra de pantalla flotando a la derecha.
 *
 * MENÚ FIEL AL MANUAL, submódulo por submódulo (lámina 13 y siguientes):
 *
 *   Tripulantes A.I.          → Personal
 *   Cooperación Civil Militar → Jornadas de apoyo, Asistencias humanitarias,
 *                               Ruedas de emprendimiento
 *   Asuntos Civiles           → Alianzas y convenios, Entidades A.I.,
 *                               Proyectos sociales
 *   Sensibilización           → Herramientas AID, Campañas de sensibilización
 *   Normatividad A.I.         → Normatividad acción integral
 *
 * ⚠️ Antes del manual, Entidades A.I. estaba bajo Cooperación Civil Militar y
 * Herramientas AID era una entrada propia. El manual las pone en Asuntos
 * Civiles y en Sensibilización, y así lo aprendió quien ya usa la PAID.
 *
 * «Lo que no se tiene permiso de usar no se muestra» (Fase 4, punto 2): ni la
 * entrada ni el desplegable entero si no queda ninguna. La interfaz oculta; el
 * servidor prohíbe.
 */

interface Entrada {
  readonly a: string;
  readonly rotulo: string;
  readonly permiso?: string;
}

interface Grupo {
  readonly rotulo: string;
  readonly hijas: readonly Entrada[];
}

const MENU: readonly (Entrada | Grupo)[] = [
  { a: '/', rotulo: 'Inicio' },
  {
    rotulo: 'Tripulantes A.I.',
    hijas: [{ a: '/tripulantes', rotulo: 'Personal', permiso: 'PERSONAL.CONSULTAR' }],
  },
  {
    rotulo: 'Cooperación Civil Militar',
    hijas: [
      { a: '/jornadas', rotulo: 'Jornadas de apoyo', permiso: 'JORNADA.CONSULTAR' },
      { a: '/asistencias', rotulo: 'Asistencias humanitarias', permiso: 'ASISTENCIA.CONSULTAR' },
      { a: '/ruedas', rotulo: 'Ruedas de emprendimiento', permiso: 'RUEDA.CONSULTAR' },
    ],
  },
  {
    rotulo: 'Asuntos Civiles',
    hijas: [
      { a: '/alianzas', rotulo: 'Alianzas y convenios', permiso: 'ALIANZA.CONSULTAR' },
      { a: '/entidades', rotulo: 'Entidades A.I.', permiso: 'ENTIDAD.CONSULTAR' },
      { a: '/proyectos', rotulo: 'Proyectos sociales', permiso: 'PROYECTO.CONSULTAR' },
    ],
  },
  {
    rotulo: 'Sensibilización',
    hijas: [
      { a: '/herramientas', rotulo: 'Herramientas AID', permiso: 'HERRAMIENTA.CONSULTAR' },
      { a: '/campanas', rotulo: 'Campañas de sensibilización', permiso: 'CAMPANA.CONSULTAR' },
    ],
  },
  {
    rotulo: 'Normatividad A.I.',
    hijas: [
      {
        a: '/normatividad',
        rotulo: 'Normatividad acción integral',
        permiso: 'NORMATIVIDAD.CONSULTAR',
      },
    ],
  },
];

const esGrupo = (e: Entrada | Grupo): e is Grupo => 'hijas' in e;

/**
 * «Cooperación Civil Militar» → «cooperacion-civil-militar». Va en `id` y en
 * `aria-controls`, y `aria-controls` es una LISTA separada por espacios: un
 * `id` con espacios apuntaría a tres elementos que no existen.
 */
const aClave = (rotulo: string): string =>
  rotulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');

export function Marco(): JSX.Element {
  const { sesion, salir, puede } = useSesion();
  const { pathname } = useLocation();
  const principal = useRef<HTMLElement | null>(null);
  const primera = useRef(true);
  const [abierto, setAbierto] = useState<string | null>(null);
  const menu = useRef<HTMLElement | null>(null);

  /*
   * Al cambiar de pantalla: arriba del todo, el foco al contenido y el
   * desplegable cerrado. Una aplicación de una sola página no recarga, así que
   * el navegador no hace ninguna de las tres cosas.
   */
  useEffect(() => {
    setAbierto(null);
    if (primera.current) {
      primera.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    principal.current?.focus({ preventScroll: true });
  }, [pathname]);

  // Un desplegable abierto se cierra con Escape o al pulsar fuera.
  useEffect(() => {
    if (abierto === null) return;
    const alPulsar = (e: MouseEvent): void => {
      if (menu.current !== null && !menu.current.contains(e.target as Node)) setAbierto(null);
    };
    const alTeclear = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        document.getElementById(`menu-${abierto}`)?.focus();
        setAbierto(null);
      }
    };
    document.addEventListener('mousedown', alPulsar);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('mousedown', alPulsar);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto]);

  if (sesion === null) return <Outlet />;

  const visibles = (hijas: readonly Entrada[]): readonly Entrada[] =>
    hijas.filter((h) => h.permiso === undefined || puede(h.permiso));

  return (
    <div className="marco">
      <a className="salto-contenido" href="#contenido">
        Saltar al contenido
      </a>

      {/* ── Barra GOV.CO, con la sesión a la derecha como en el manual ──── */}
      <div className="govco">
        <span className="govco-logo">GOV.CO</span>
        <span className="govco-texto">Conoce toda la oferta que el estado tiene para ti.</span>
        <div className="govco-sesion">
          <RelojSesion />
          <span className="pildora-usuario">
            <span className="pildora-icono" aria-hidden="true">
              <Usuario tamano={16} />
            </span>
            <span className="pildora-nombre">
              <span className="datos">{sesion.credencial}</span>
              <span className="pildora-unidad">
                {sesion.unidad.sigla} · {sesion.roles.join(', ')}
              </span>
            </span>
            <button
              type="button"
              className="pildora-salir"
              onClick={() => void salir()}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              X
            </button>
          </span>
        </div>
      </div>

      {/* ── Cabecera azul ─────────────────────────────────────────────────── */}
      <header className="cabecera">
        <div className="cabecera-fila">
          <div className="cabecera-ministerio">Ministerio de Defensa Nacional</div>
          <div className="cabecera-titulo">
            <div>
              <p className="cabecera-paid">PAID</p>
              <p className="cabecera-plataforma">Plataforma de Acción Integral y Desarrollo</p>
            </div>
            <EmblemaJacid alto={62} alternativo="Jefatura de Acción Integral y Desarrollo" />
          </div>
          <div className="cabecera-armada">
            <LogotipoArmada alto={52} />
          </div>
        </div>

        <nav className="menu" aria-label="Menú principal" ref={menu}>
          <ul className="menu-lista">
            {MENU.map((entrada) => {
              if (!esGrupo(entrada)) {
                return (
                  <li key={entrada.a}>
                    <NavLink
                      to={entrada.a}
                      end
                      className={({ isActive }) => `menu-enlace ${isActive ? 'es-activo' : ''}`}
                    >
                      {entrada.rotulo}
                    </NavLink>
                  </li>
                );
              }
              const hijas = visibles(entrada.hijas);
              if (hijas.length === 0) return null;
              const clave = aClave(entrada.rotulo);
              const activo = hijas.some((h) => pathname.startsWith(h.a));
              const estaAbierto = abierto === clave;
              return (
                <li key={clave} className="menu-grupo">
                  {/*
                   * Patrón «disclosure» de WAI-ARIA: un botón con
                   * `aria-expanded` que muestra una lista de enlaces. No es un
                   * `role="menu"`: ese rol promete la navegación con flechas
                   * de un menú de escritorio, y prometerla sin darla es peor
                   * que no prometerla.
                   */}
                  <button
                    type="button"
                    id={`menu-${clave}`}
                    className={`menu-enlace menu-boton ${activo ? 'es-activo' : ''}`}
                    aria-expanded={estaAbierto}
                    aria-controls={`submenu-${clave}`}
                    onClick={() => setAbierto(estaAbierto ? null : clave)}
                  >
                    {entrada.rotulo}
                    <Flecha tamano={14} className={estaAbierto ? 'gira' : ''} />
                  </button>
                  <ul
                    id={`submenu-${clave}`}
                    className="submenu"
                    hidden={!estaAbierto}
                  >
                    {hijas.map((hija) => (
                      <li key={hija.a}>
                        <NavLink
                          to={hija.a}
                          className={({ isActive }) =>
                            `submenu-enlace ${isActive ? 'es-activo' : ''}`
                          }
                        >
                          {hija.rotulo}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="contenido" id="contenido" tabIndex={-1} ref={principal}>
        <Outlet />
      </main>

      <PieInstitucional />
      <ControlesAccesibilidad />

      {/* Región para anuncios de lector de pantalla. Una sola, viva siempre:
          crearla al momento de anunciar no funciona, el lector no la observa. */}
      <div id="anuncios" className="solo-lectores" role="status" aria-live="polite" />
    </div>
  );
}

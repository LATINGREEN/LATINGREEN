import { Navigate, Route, Routes } from 'react-router-dom';
import { useSesion } from './api/sesion';
import { Marco } from './componentes/Marco';
import { Ingreso } from './paginas/Ingreso';
import { Inicio } from './paginas/Inicio';
import { Jornadas } from './paginas/Jornadas';
import { JornadaFormulario } from './paginas/JornadaFormulario';
import { Tripulantes } from './paginas/Tripulantes';
import { Entidades } from './paginas/Entidades';
import { Herramientas } from './paginas/Herramientas';
import { Normatividad } from './paginas/Normatividad';
import { Pendiente } from './paginas/Pendiente';

/**
 * Rutas.
 *
 * Dos reglas gobiernan este archivo:
 *
 * 1. SIN SESIÓN, SOLO INGRESO. No hay ruta que se dibuje a medias esperando
 *    datos: cualquier URL sin sesión lleva al ingreso. Con un testigo en
 *    memoria (y no en `localStorage`, ver `api/sesion.tsx`), recargar la
 *    página es cerrar la sesión de este navegador, y eso es correcto en un
 *    equipo compartido.
 *
 * 2. LA INTERFAZ OCULTA; EL SERVIDOR PROHÍBE. `Marco` esconde del menú lo que
 *    la credencial no puede usar, pero estas rutas siguen existiendo: quien
 *    escriba la URL llega a la pantalla y recibe el 403 del servidor, que es
 *    la defensa de verdad. Ocultar la ruta además sería redundante; ocultar
 *    SOLO la ruta sería una falsa seguridad.
 *
 * `GuardaSesion` no se usa por ruta: el `Marco` ya devuelve el `Outlet` sin
 * marco cuando no hay sesión, y aquí se decide a dónde va ese `Outlet`.
 */
export function App(): JSX.Element {
  const { sesion } = useSesion();

  if (sesion === null) {
    return (
      <Routes>
        <Route path="/ingreso" element={<Ingreso />} />
        {/* Cualquier otra cosa, al ingreso. `replace` para que el botón
            «atrás» no devuelva a una pantalla que no se puede dibujar. */}
        <Route path="*" element={<Navigate to="/ingreso" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Marco />}>
        <Route path="/" element={<Inicio />} />

        <Route path="/tripulantes" element={<Tripulantes />} />
        <Route path="/entidades" element={<Entidades />} />
        <Route path="/herramientas" element={<Herramientas />} />
        <Route path="/normatividad" element={<Normatividad />} />

        <Route path="/jornadas" element={<Jornadas />} />
        <Route path="/jornadas/nueva" element={<JornadaFormulario />} />
        <Route path="/jornadas/:id" element={<JornadaFormulario />} />

        {/*
          * Los submódulos del manual que todavía no tienen módulo propio. Las
          * cuatro actividades comparten el supertipo y las pestañas de la
          * jornada, y cuáles pestañas lleva cada una lo dice ahora el manual
          * (láminas 28, 32, 43 y 51): es trabajo de la Parte A que sigue.
          */}
        <Route
          path="/asistencias"
          element={
            <Pendiente
              rotulo="Cooperación Civil Militar"
              titulo="Asistencias humanitarias"
              motivo="Comparte con las jornadas el supertipo de actividad. El manual fija sus campos —tipo directa o indirecta, plan operacional— y sus pestañas (lámina 28), que no incluyen Servicios Prestados."
            />
          }
        />
        <Route
          path="/ruedas"
          element={
            <Pendiente
              rotulo="Cooperación Civil Militar"
              titulo="Ruedas de emprendimiento"
              motivo="Comparte con las jornadas el supertipo de actividad. Según el manual (lámina 32) lleva seis pestañas: tipo de operación, entidades apoyadas, población beneficiada, medios de difusión, medios utilizados y recursos utilizados."
            />
          }
        />
        <Route
          path="/alianzas"
          element={
            <Pendiente
              rotulo="Asuntos Civiles"
              titulo="Alianzas y convenios"
              motivo="El porcentaje de avance de un convenio ya está implementado en el servidor, y solo JACID puede diligenciarlo. El manual (lámina 35) aclara que las unidades solo registran alianzas; los convenios los concierta JACID."
            />
          }
        />
        <Route
          path="/proyectos"
          element={
            <Pendiente
              rotulo="Asuntos Civiles"
              titulo="Proyectos sociales"
              motivo="La escala de avance (10, 20, 30, 40, 50, 60, 70 y 100 %) ya está impuesta en la base. El manual (lámina 42) dice qué soportes corresponden a cada tramo; la pantalla está por construir."
            />
          }
        />
        <Route
          path="/campanas"
          element={
            <Pendiente
              rotulo="Sensibilización"
              titulo="Campañas de sensibilización"
              motivo="Espera el catálogo de las 17 campañas institucionales de COGFM (Q2), que se dejó vacío a propósito en lugar de inventarlo."
            />
          }
        />
        {/* Las direcciones anteriores al manual, para enlaces guardados. */}
        <Route path="/asuntos-civiles" element={<Navigate to="/entidades" replace />} />
        <Route path="/sensibilizacion" element={<Navigate to="/herramientas" replace />} />

        {/* Una ruta que no existe no es un error del usuario: se le devuelve
            al inicio en lugar de mostrarle una pantalla en blanco. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

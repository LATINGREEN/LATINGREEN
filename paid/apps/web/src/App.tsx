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

        <Route
          path="/alianzas"
          element={
            <Pendiente
              rotulo="Cooperación Civil Militar"
              titulo="Alianzas y convenios"
              motivo="El porcentaje de avance de un convenio ya está implementado en el servidor, y solo JACID puede diligenciarlo. La pantalla de gestión de alianzas espera a que se defina qué distingue una alianza de un convenio en el registro, que no está escrito."
            />
          }
        />
        <Route
          path="/asuntos-civiles"
          element={
            <Pendiente
              rotulo="Asuntos Civiles"
              titulo="Asistencia humanitaria"
              motivo="Comparte con las jornadas el mismo supertipo de actividad y las mismas once pestañas. Cómo se agrupan las pestañas en cada tipo de actividad depende de una pregunta abierta a JACID; construirla suponiendo la respuesta obligaría a rehacerla con datos dentro."
            />
          }
        />
        <Route
          path="/sensibilizacion"
          element={
            <Pendiente
              rotulo="Sensibilización"
              titulo="Campañas institucionales"
              motivo="El servidor ya impone que una campaña asociada a una actividad sea una campaña de la Fuerza, no de la unidad. La pantalla espera el catálogo de campañas, que lo diligencia JACID y hoy está vacío a propósito."
            />
          }
        />

        {/* Una ruta que no existe no es un error del usuario: se le devuelve
            al inicio en lugar de mostrarle una pantalla en blanco. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

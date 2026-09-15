import { useQuery } from '@tanstack/react-query';
import {
  CANTIDAD_PESTANAS,
  COAMI,
  CUOTA_BYTES_POR_ACTIVIDAD,
  FORMULARIOS_CON_GEORREFERENCIA,
  TRAMOS_AVANCE,
  formatearBytes,
} from '@paid/schema';

interface RespuestaSalud {
  readonly estado: string;
  readonly servicio: string;
  readonly instanteUtc: string;
}

async function consultarSalud(): Promise<RespuestaSalud> {
  const respuesta = await fetch('/api/salud');
  if (!respuesta.ok) {
    throw new Error(`La API respondió ${respuesta.status}`);
  }
  return (await respuesta.json()) as RespuestaSalud;
}

/**
 * Cascaron de la Fase 0. No es la interfaz de la PAID: es la comprobacion de
 * que el andamiaje esta en pie (React 18 + Vite 5 + TanStack Query + el
 * esquema Zod compartido) y de que la API responde.
 *
 * El menu fiel al manual (Inicio · Tripulantes A.I. · Cooperacion Civil
 * Militar · Asuntos Civiles · Sensibilizacion · Normatividad A.I.), los
 * maestros, el formulario de once pestanas y los controles de accesibilidad
 * llegan en la Fase 4.
 */
export function App(): JSX.Element {
  const salud = useQuery({ queryKey: ['salud'], queryFn: consultarSalud });

  return (
    <main className="contenedor">
      <header>
        <h1>PAID</h1>
        <p className="subtitulo">
          Plataforma de Acción Integral y Desarrollo · Armada de Colombia
        </p>
      </header>

      <section aria-labelledby="titulo-estado">
        <h2 id="titulo-estado">Estado del andamiaje</h2>
        <dl className="estado">
          <dt>API</dt>
          <dd>
            {salud.isPending && <span>Consultando…</span>}
            {salud.isError && (
              <span className="incidencia">
                No responde. La interfaz se dibuja igual: ninguna pantalla depende de
                un servicio para existir.
              </span>
            )}
            {salud.isSuccess && (
              <span className="correcto">
                {salud.data.servicio} · {salud.data.estado}
              </span>
            )}
          </dd>

          <dt>Esquema Zod compartido</dt>
          <dd className="correcto">
            cargado — el mismo que validará en el servidor
          </dd>
        </dl>
      </section>

      <section aria-labelledby="titulo-invariantes">
        <h2 id="titulo-invariantes">Invariantes ya fijados en código</h2>
        <p className="nota">
          Leídos de <code>@paid/schema</code>. Si alguno se muestra distinto de lo que
          dice el manual, hay un defecto.
        </p>
        <ul className="invariantes">
          <li>
            <strong>Escala de avance (R10):</strong> {TRAMOS_AVANCE.join(' · ')}
            <em> — no existen 80 ni 90</em>
          </li>
          <li>
            <strong>Cuota de adjuntos (R11):</strong>{' '}
            {formatearBytes(CUOTA_BYTES_POR_ACTIVIDAD)} agregados por actividad
          </li>
          <li>
            <strong>Pestañas obligatorias (R19):</strong> {CANTIDAD_PESTANAS}
          </li>
          <li>
            <strong>Formularios con georreferenciación (R13):</strong>{' '}
            {FORMULARIOS_CON_GEORREFERENCIA.length}
          </li>
          <li>
            <strong>COAMI (R18):</strong> {COAMI.length}, ninguno marcado por defecto
          </li>
        </ul>
      </section>

      <section aria-labelledby="titulo-pendiente">
        <h2 id="titulo-pendiente">Pendiente</h2>
        <p className="incidencia">
          La Fase 1 (base de datos) está detenida: falta{' '}
          <code>anexo_A_ddl_paid.sql</code>, el DDL de referencia. PROMPT.md prohíbe
          improvisar el esquema. Ver <code>docs/BITACORA.md</code>.
        </p>
      </section>
    </main>
  );
}

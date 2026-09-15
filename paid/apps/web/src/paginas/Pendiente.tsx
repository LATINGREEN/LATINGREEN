import { Link } from 'react-router-dom';
import { Brujula, Info } from '../componentes/Iconos';

/**
 * Pantalla para las entradas del menú cuyo módulo todavía no existe:
 * Asuntos Civiles (asistencia humanitaria), Sensibilización (campañas) y
 * Alianzas.
 *
 * Existe en lugar de un enlace muerto o de un formulario a medias. Dice QUÉ
 * falta y POR QUÉ, y eso no es una disculpa: las tres comparten el supertipo
 * `ai.actividad` con las jornadas y las once pestañas, y cómo se agrupan
 * depende de Q4, que sigue sin respuesta. Construirlas suponiendo la respuesta
 * significaría rehacerlas —con datos dentro— cuando llegue.
 *
 * Un estado vacío es una invitación a actuar, no un callejón: se ofrece lo que
 * sí se puede hacer hoy.
 */
export function Pendiente({
  rotulo,
  titulo,
  motivo,
}: {
  readonly rotulo: string;
  readonly titulo: string;
  readonly motivo: string;
}): JSX.Element {
  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <span className="rotulo">{rotulo}</span>
          <h1>{titulo}</h1>
        </div>
      </div>

      <div className="tarjeta vacio">
        <Brujula tamano={34} />
        <h3>Este módulo todavía no está</h3>
        <p>{motivo}</p>
        <div className="fila envolver" style={{ justifyContent: 'center' }}>
          <Link to="/jornadas" className="boton boton-primario">
            Ir a Jornadas de Apoyo
          </Link>
          <Link to="/" className="boton boton-secundario">
            Volver al inicio
          </Link>
        </div>
      </div>

      <div className="aviso aviso-info" style={{ marginTop: 'var(--e-5)' }}>
        <span className="aviso-icono">
          <Info tamano={18} />
        </span>
        <p>
          Las preguntas abiertas están en <code>docs/PREGUNTAS-JACID.md</code>. Ninguna
          se ha rellenado con un supuesto: un campo inventado que parece plausible es
          peor que un campo que falta, porque nadie vuelve a revisarlo.
        </p>
      </div>
    </>
  );
}

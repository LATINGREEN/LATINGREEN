/**
 * El pie de la PAID, transcrito de la lámina 12 del Manual del Usuario.
 *
 * Dos diferencias con el original, las dos por A.2.1 (sin internet en tiempo
 * de ejecución):
 *
 * - Las redes sociales van como texto y NO como enlaces. La plataforma opera
 *   en la Intranet ARC; un enlace a Twitter o a YouTube desde ahí no abre, y
 *   ofrecerlo es ofrecer algo que falla.
 * - Los logotipos GOV.CO y «CO Colombia» van en texto: no se entregaron los
 *   archivos (ver public/identidad/LEEME.md).
 *
 * El `id="contacto"` es el destino del botón «Contáctenos» de la barra de
 * pantalla, como en el manual.
 */
export function PieInstitucional(): JSX.Element {
  const anio = new Date().getFullYear();
  return (
    <footer className="pie">
      <p className="pie-derechos">
        Copyright © 2021 - {anio} Armada Nacional - División de Informática. Todos los
        Derechos Reservados
      </p>
      <div className="pie-columnas">
        <div className="pie-govco" aria-label="Portal del Estado colombiano">
          <span className="govco-logo">GOV.CO</span>
          <span className="pie-co" aria-hidden="true">
            CO
          </span>
        </div>
        <div className="pie-jefatura">
          <p className="pie-titulo">Jefatura de Acción Integral y Desarrollo</p>
          <p className="pie-lema">«Protegemos el Azul de la Bandera»</p>
          <p>Dirección: Edificio WBC World Business Center Ak. 86 #51-66, Bogotá D.C.</p>
          <p>Código Postal: 111071000</p>
          <p>Horario de Atención: Lunes a Viernes 08:00 am - 05:00 pm.</p>
          <ul className="pie-redes" aria-label="Redes sociales de la Armada">
            <li>Twitter</li>
            <li>Instagram</li>
            <li>Facebook</li>
            <li>YouTube</li>
          </ul>
        </div>
        <div className="pie-contacto" id="contacto" tabIndex={-1}>
          <p className="pie-titulo">Contacto</p>
          <p>Teléfono Conmutador: +57 6013692000 ext: 10700</p>
          <p>Línea Gratuita: 01 800 11 13 80</p>
          <p>Correo Institucional: jacid@armada.mil.co</p>
          <p>Política de seguridad de la información</p>
        </div>
      </div>
      <p className="pie-clasificacion">
        Información Público Clasificado · Intranet ARC
      </p>
    </footer>
  );
}

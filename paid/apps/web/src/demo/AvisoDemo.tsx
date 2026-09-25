/**
 * Franja que distingue la demostración de la plataforma. Va arriba de todo,
 * en todas las pantallas, sin forma de cerrarla: quien vea una captura o reciba
 * el enlace tiene que saber que no está en la PAID real.
 */
export function AvisoDemo(): JSX.Element {
  return (
    <div className="aviso-demo" role="note">
      <strong>Demostración del prototipo.</strong>{' '}
      <span>
        Funciona sin servidor: los datos son de ejemplo y se pierden al recargar la página. No es la
        plataforma oficial. Credencial <code>BIM23_PAID</code>, clave <code>Desarrollo2026*</code>.
      </span>
    </div>
  );
}

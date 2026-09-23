import { useEffect } from 'react';

/**
 * Avisa antes de cerrar o recargar la pestaña con cambios sin guardar.
 *
 * Dos razones, y la segunda es propia de esta aplicación:
 *
 * 1. Un clavegrama pegado y medio formulario diligenciado se pierden sin
 *    aviso al cerrar la pestaña por error.
 * 2. **Recargar cierra la sesión**: el testigo vive en memoria a propósito
 *    (ver `api/sesion.tsx`). Quien pulse F5 «para ver si se guardó» pierde el
 *    borrador Y la sesión. El navegador pregunta antes de hacerlo.
 *
 * No se guarda un borrador en el almacenamiento del navegador para
 * recuperarlo después, y es deliberado: son datos clasificados en un equipo
 * que se comparte en la unidad. Por la misma razón el testigo no va ahí.
 */
export function useAvisoSalida(hayCambios: boolean): void {
  useEffect(() => {
    if (!hayCambios) return;
    const avisar = (evento: BeforeUnloadEvent): void => {
      evento.preventDefault();
      // Algunos navegadores todavía exigen `returnValue` para mostrar el aviso.
      evento.returnValue = '';
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [hayCambios]);
}

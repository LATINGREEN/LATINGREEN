import { SetMetadata } from '@nestjs/common';

export const CLAVE_PERMISO = 'paid:permiso';

/**
 * P4 — Control de acceso por permiso, no por nombre de rol.
 *
 *     @RequierePermiso('JORNADA.EDITAR')
 *
 * Se exige el PERMISO y no el rol a proposito: si el guarda comprobara
 * «¿es OPERADOR_UNIDAD?», cambiar la matriz de permisos obligaria a tocar
 * codigo, y R16 —que centraliza atribuciones en JACID— dejaria de ser
 * configurable. Con permisos, la matriz vive en `seg.rol_permiso` y el codigo
 * solo dice que hace falta.
 */
export const RequierePermiso = (...permisos: readonly string[]) =>
  SetMetadata(CLAVE_PERMISO, permisos);

/** Marca una ruta como publica: no exige sesion. El ingreso, la salud. */
export const CLAVE_PUBLICA = 'paid:publica';
export const RutaPublica = () => SetMetadata(CLAVE_PUBLICA, true);

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CODIGOS_ERROR } from '@paid/schema';
import { CLAVE_PERMISO } from './requiere-permiso.decorator';
import type { PeticionConSesion } from './sesion.guard';

/**
 * P4 — Autorizacion por permiso.
 *
 * Corre DESPUES de `SesionGuard`, que ya dejo la sesion en la peticion con sus
 * permisos efectivos (roles vigentes en el momento del ingreso).
 *
 * R16 se apoya entera en esto: `OPERADOR_UNIDAD` no tiene `ALIANZA.AVANCE` en
 * la matriz, asi que recibe 403 al intentarlo. Es lo que comprueba la Puerta 2.
 */
@Injectable()
export class PermisoGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<readonly string[]>(CLAVE_PERMISO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (requeridos === undefined || requeridos.length === 0) return true;

    const peticion = contexto.switchToHttp().getRequest<PeticionConSesion>();
    const sesion = peticion.sesion;
    if (sesion === undefined) {
      throw new ForbiddenException({
        codigo: CODIGOS_ERROR.ACCESO_DENEGADO,
        mensaje: 'Acceso denegado.',
      });
    }

    // Basta UNO de los permisos declarados. Varios en un decorador significan
    // «cualquiera de estos sirve», no «todos».
    const tiene = requeridos.some((permiso) => sesion.permisos.includes(permiso));
    if (!tiene) {
      throw new ForbiddenException({
        codigo: CODIGOS_ERROR.ACCESO_DENEGADO,
        mensaje: 'No tiene permiso para esta operación.',
      });
    }
    return true;
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { CABECERA_TESTIGO, CODIGOS_ERROR } from '@paid/schema';
import { CLAVE_PUBLICA } from './requiere-permiso.decorator';
import { SesionService } from './sesion.service';
import type { SesionActiva } from './sesion.service';

/** La peticion, con la sesion validada colgada. */
export interface PeticionConSesion extends Request {
  sesion?: SesionActiva;
  direccionIpReal?: string;
}

/**
 * R1 — La expiracion de sesion se evalua EN EL SERVIDOR, y se desplaza en cada
 * peticion autenticada.
 *
 * Este guarda es el unico sitio donde eso ocurre. Que sea uno solo importa: si
 * hubiera dos caminos para validar una sesion, uno de los dos acabaria sin
 * desplazar el TTL y las sesiones caducarian a los 10 minutos de abrirse en
 * lugar de a los 10 de inactividad.
 */
@Injectable()
export class SesionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sesiones: SesionService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const esPublica = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICA, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (esPublica === true) return true;

    const peticion = contexto.switchToHttp().getRequest<PeticionConSesion>();
    const cabecera = peticion.headers[CABECERA_TESTIGO];
    const testigo = typeof cabecera === 'string' ? cabecera : undefined;

    if (testigo === undefined || testigo === '') {
      throw new UnauthorizedException({
        codigo: CODIGOS_ERROR.SESION_EXPIRADA,
        mensaje: 'La sesión no está activa.',
      });
    }

    const sesion = await this.sesiones.validarYDesplazar(testigo);
    if (sesion === null) {
      // R1: 10 minutos de inactividad. El mensaje es el mismo para «no existe»
      // y «vencida»: al cliente le da igual, y distinguirlo solo informaria a
      // quien esta probando testigos.
      throw new UnauthorizedException({
        codigo: CODIGOS_ERROR.SESION_EXPIRADA,
        mensaje: 'La sesión expiró por inactividad.',
      });
    }

    peticion.sesion = sesion;
    return true;
  }
}

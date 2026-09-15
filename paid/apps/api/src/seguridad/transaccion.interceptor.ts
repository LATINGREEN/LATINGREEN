import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, firstValueFrom, from } from 'rxjs';
import { BaseDatosService } from '../basedatos/basedatos.service';
import { SesionService } from './sesion.service';
import type { PeticionConSesion } from './sesion.guard';

/**
 * ⚠️ R7 / P11 — Interceptor de transaccion.
 *
 * Envuelve cada peticion AUTENTICADA en una transaccion que fija el contexto
 * de sesion con `SET LOCAL` en su primera sentencia. A partir de ahi, todo lo
 * que el controlador y los servicios hagan contra la base va dentro de esa
 * transaccion, con RLS mirando al usuario correcto y la bitacora sabiendo
 * quien escribe.
 *
 * `SET LOCAL` (no `SET`) es obligatorio: el pool reutiliza conexiones entre
 * peticiones, y un `SET` normal deja el valor pegado a la conexion. La
 * siguiente peticion, de otra unidad, heredaria el contexto de la anterior:
 * una fuga de datos entre usuarios, silenciosa y dificil de ver en una
 * revision de codigo.
 *
 * El mecanismo concreto esta en `packages/db/src/contexto.ts`; aqui esta el
 * punto donde se aplica. La Puerta 2 lo comprueba con `pool.max = 1`, que
 * fuerza la reutilizacion de la conexion.
 */
@Injectable()
export class TransaccionInterceptor implements NestInterceptor {
  constructor(
    private readonly baseDatos: BaseDatosService,
    private readonly sesiones: SesionService,
  ) {}

  intercept(contexto: ExecutionContext, siguiente: CallHandler): Observable<unknown> {
    const peticion = contexto.switchToHttp().getRequest<PeticionConSesion>();
    const sesion = peticion.sesion;

    // Sin sesion no hay contexto que fijar. Son las rutas publicas —el propio
    // ingreso, la sonda de salud—, que no tocan tablas con RLS.
    if (sesion === undefined) {
      return siguiente.handle();
    }

    const ip = peticion.direccionIpReal ?? peticion.ip ?? '0.0.0.0';
    const contextoSesion = this.sesiones.contextoDe(sesion, ip);

    // El observable del manejador se materializa DENTRO de la transaccion con
    // `firstValueFrom`. Si se dejara fuera, el manejador podria emitir despues
    // del COMMIT y sus consultas correrian sin contexto — el fallo que R7
    // previene, reintroducido por la puerta de atras.
    return from(
      this.baseDatos.enTransaccion(contextoSesion, () =>
        firstValueFrom(siguiente.handle() as Observable<unknown>),
      ),
    );
  }
}

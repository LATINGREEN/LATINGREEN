import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CABECERA_TESTIGO,
  CODIGOS_ERROR,
  MENSAJE_CREDENCIALES_INVALIDAS,
  solicitudIngreso,
} from '@paid/schema';
import type { RespuestaIngreso, RetoCaptcha } from '@paid/schema';
import { AutenticacionService } from './autenticacion.service';
import { SesionService } from './sesion.service';
import { RutaPublica } from './requiere-permiso.decorator';
import type { PeticionConSesion } from './sesion.guard';

@Controller('autenticacion')
export class AutenticacionController {
  constructor(
    private readonly autenticacion: AutenticacionService,
    private readonly sesiones: SesionService,
  ) {}

  /**
   * Paso 1: el reto de captcha (R3). Cada ingreso lo exige.
   *
   * Si la red no esta autorizada (R2) responde lo MISMO que un ingreso
   * fallido: no se le confirma a quien esta fuera de la red que su problema es
   * la red.
   */
  @RutaPublica()
  @Post('reto')
  @HttpCode(HttpStatus.OK)
  async reto(@Req() peticion: PeticionConSesion): Promise<RetoCaptcha> {
    const reto = await this.autenticacion.emitirReto(this.ipDe(peticion));
    if (reto === null) {
      throw new UnauthorizedException({
        codigo: CODIGOS_ERROR.CREDENCIALES_INVALIDAS,
        mensaje: MENSAJE_CREDENCIALES_INVALIDAS,
      });
    }
    return reto;
  }

  /**
   * El ingreso.
   *
   * ⚠️ R4. Este metodo tiene UN solo camino de fallo, con UN solo cuerpo y UN
   * solo codigo HTTP, sea cual sea la causa de las ocho. La Puerta 2 comprueba
   * que «usuario inexistente» y «contrasena errada» devuelven exactamente lo
   * mismo.
   *
   * Tampoco se distinguen los datos mal formados: un `credencial` que no cumple
   * el patron de R5 responde igual que una credencial que no existe. Si
   * respondiera 400 con detalle de validacion, el formato de las credenciales
   * quedaria expuesto.
   */
  @RutaPublica()
  @Post('ingreso')
  @HttpCode(HttpStatus.OK)
  async ingreso(
    @Body() cuerpo: unknown,
    @Req() peticion: PeticionConSesion,
  ): Promise<RespuestaIngreso> {
    const rechazo = new UnauthorizedException({
      codigo: CODIGOS_ERROR.CREDENCIALES_INVALIDAS,
      mensaje: MENSAJE_CREDENCIALES_INVALIDAS,
    });

    const validada = solicitudIngreso.safeParse(cuerpo);
    if (!validada.success) throw rechazo;

    const agente = peticion.headers['user-agent'];
    const resultado = await this.autenticacion.ingresar(
      validada.data,
      this.ipDe(peticion),
      typeof agente === 'string' ? agente : null,
    );
    if (resultado === null) throw rechazo;

    return resultado.respuesta;
  }

  /**
   * Estado de la sesion en curso.
   *
   * Existe para que la interfaz pueda RENOVAR: R1 tiene expiracion deslizante,
   * asi que cualquier peticion autenticada desplaza el TTL. Esta es la mas
   * liviana posible y no modifica nada, de modo que el boton «Seguir
   * trabajando» del aviso de expiracion no tenga efectos secundarios.
   *
   * No es publica: pasa por `SesionGuard`, que es precisamente lo que
   * desplaza la expiracion.
   */
  @Get('sesion')
  sesionActual(@Req() peticion: PeticionConSesion): {
    credencial: string;
    expiraEnUtc: string;
    roles: readonly string[];
    permisos: readonly string[];
  } {
    const sesion = peticion.sesion;
    if (sesion === undefined) {
      // No deberia ocurrir: el guarda ya la valido.
      throw new UnauthorizedException({
        codigo: CODIGOS_ERROR.SESION_EXPIRADA,
        mensaje: 'La sesión no está activa.',
      });
    }
    return {
      credencial: sesion.credencial,
      expiraEnUtc: sesion.expiraEnUtc,
      roles: sesion.roles,
      permisos: sesion.permisos,
    };
  }

  /** Cierre de sesion a peticion del usuario. */
  @RutaPublica()
  @Post('salida')
  @HttpCode(HttpStatus.NO_CONTENT)
  async salida(@Req() peticion: PeticionConSesion): Promise<void> {
    const cabecera = peticion.headers[CABECERA_TESTIGO];
    if (typeof cabecera === 'string' && cabecera !== '') {
      await this.sesiones.cerrar(cabecera, 'CIERRE_USUARIO');
    }
    // Sin testigo tambien responde 204: cerrar una sesion que no existe no es
    // un error, y distinguirlo informaria de que testigos son validos.
  }

  /**
   * R2 — La IP de origen real.
   *
   * Detras de nginx, `peticion.ip` es la del proxy. La validacion de red
   * autorizada tiene que mirar `X-Forwarded-For`, que nginx rellena (ver
   * `docker/web/nginx.conf`).
   *
   * ⚠️ Esa cabecera la puede falsificar quien llegue DIRECTAMENTE a la API sin
   * pasar por el proxy. Por eso el despliegue debe exponer unicamente nginx, y
   * `docker-compose.yml` no publica el puerto de la API hacia fuera de la red
   * interna. Queda anotado aqui porque es el punto donde se confia en ella.
   */
  private ipDe(peticion: PeticionConSesion): string {
    const reenviada = peticion.headers['x-forwarded-for'];
    if (typeof reenviada === 'string' && reenviada !== '') {
      const primera = reenviada.split(',')[0]?.trim();
      if (primera !== undefined && primera !== '') {
        peticion.direccionIpReal = primera;
        return primera;
      }
    }
    const ip = peticion.ip ?? '0.0.0.0';
    // Express entrega IPv4 mapeadas como ::ffff:10.0.0.1, que `inet` de
    // PostgreSQL no compara contra un CIDR IPv4.
    const limpia = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
    peticion.direccionIpReal = limpia;
    return limpia;
  }
}

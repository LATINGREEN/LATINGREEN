import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
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
import { ConfigService } from '@nestjs/config';
import { AutenticacionService } from './autenticacion.service';
import { ipDeOrigen } from './ip-origen';
import { SesionService } from './sesion.service';
import { RutaPublica } from './requiere-permiso.decorator';
import type { PeticionConSesion } from './sesion.guard';

@Controller('autenticacion')
export class AutenticacionController {
  private readonly proxiesDeConfianza: number;

  constructor(
    private readonly autenticacion: AutenticacionService,
    private readonly sesiones: SesionService,
    @Inject(ConfigService) configuracion: ConfigService,
  ) {
    this.proxiesDeConfianza = configuracion.get<number>('PROXIES_DE_CONFIANZA') ?? 1;
  }

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
   * Detras de nginx, `peticion.ip` es la del proxy; la real viaja en
   * `X-Forwarded-For` (ver `docker/web/nginx.conf`). De esa cabecera solo se
   * cree la entrada que escribio un proxy de confianza, no la que manda el
   * cliente: ver `ip-origen.ts`.
   *
   * ⚠️ Quien llegue DIRECTAMENTE a la API, sin pasar por el proxy, puede
   * escribir la cabecera entera. Por eso el despliegue expone unicamente
   * nginx, y `docker-compose.yml` no publica el puerto de la API.
   */
  private ipDe(peticion: PeticionConSesion): string {
    const ip = ipDeOrigen(
      peticion.headers['x-forwarded-for'],
      peticion.ip,
      this.proxiesDeConfianza,
    );
    peticion.direccionIpReal = ip;
    return ip;
  }
}

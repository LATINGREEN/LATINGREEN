import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BaseDatosService } from '../basedatos/basedatos.service';
import { CaptchaService } from '../seguridad/captcha.service';
import { SesionService } from '../seguridad/sesion.service';

/**
 * Tareas programadas.
 *
 * R1 pide una «tarea programada que cierra las vencidas». Redis olvida las
 * claves solo, pero `seg.sesion` es el registro durable: una sesion que
 * quedara «abierta» ahi para siempre haria inutil cualquier consulta sobre
 * sesiones activas, y borraria la distincion entre «se cerro» y «caduco».
 */
@Injectable()
export class TareasService {
  private readonly registro = new Logger(TareasService.name);

  constructor(
    private readonly sesiones: SesionService,
    private readonly captchas: CaptchaService,
    private readonly baseDatos: BaseDatosService,
  ) {}

  /** R1 — cada minuto. El TTL es de 10, asi que un minuto de retraso sobra. */
  @Cron(CronExpression.EVERY_MINUTE)
  async cerrarSesionesVencidas(): Promise<void> {
    try {
      const cerradas = await this.sesiones.cerrarVencidas();
      if (cerradas > 0) {
        this.registro.log({ cerradas }, 'Sesiones cerradas por expiracion');
      }
    } catch (error: unknown) {
      // Una tarea programada que lanza tumba el proceso en algunas
      // configuraciones. Se registra y se sigue.
      this.registro.error({ error }, 'Fallo al cerrar sesiones vencidas');
    }
  }

  /**
   * R3 — poda de captchas. Se conservan una hora tras caducar, no se borran al
   * instante: un captcha caducado es evidencia de un intento, y
   * `seg.intento_autenticacion` lo referencia.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async podarCaptchas(): Promise<void> {
    try {
      const podados = await this.baseDatos.enTransaccionDeSistema((cliente) =>
        this.captchas.podarCaducados(cliente),
      );
      if (podados > 0) {
        this.registro.log({ podados }, 'Captchas caducados podados');
      }
    } catch (error: unknown) {
      this.registro.error({ error }, 'Fallo al podar captchas');
    }
  }
}

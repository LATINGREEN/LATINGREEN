import { Module } from '@nestjs/common';
import { RedisService } from '../basedatos/redis.service';
import { AutenticacionController } from './autenticacion.controller';
import { AutenticacionService } from './autenticacion.service';
import { CaptchaService } from './captcha.service';
import { ClaveService } from './clave.service';
import { PermisoGuard } from './permiso.guard';
import { RedService } from './red.service';
import { SesionGuard } from './sesion.guard';
import { SesionService } from './sesion.service';
import { TransaccionInterceptor } from './transaccion.interceptor';

@Module({
  controllers: [AutenticacionController],
  providers: [
    AutenticacionService,
    CaptchaService,
    ClaveService,
    RedService,
    SesionService,
    RedisService,
    SesionGuard,
    PermisoGuard,
    TransaccionInterceptor,
  ],
  exports: [
    AutenticacionService,
    CaptchaService,
    ClaveService,
    RedService,
    SesionService,
    SesionGuard,
    PermisoGuard,
    TransaccionInterceptor,
  ],
})
export class SeguridadModule {}

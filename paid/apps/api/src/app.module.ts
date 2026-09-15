import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validarConfiguracion } from './configuracion';
import { SaludModule } from './salud/salud.module';
import { CABECERA_ID_CORRELACION, generarIdCorrelacion } from './comun/id-correlacion';

/**
 * Modulo raiz.
 *
 * Lo que **todavia no esta** y por que:
 *
 * - Modulo de autenticacion, guardas de permiso e interceptor de transaccion
 *   con `SET LOCAL` (R7): Fase 2.
 * - Modulos de dominio (jornadas, asistencias, ...): Fase 3, y dependen del
 *   esquema de la Fase 1, que a su vez espera `anexo_A_ddl_paid.sql`.
 * - Cliente de IA con cortacircuitos (IA6): Fase 6.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validarConfiguracion,
      // Sin `.env` en produccion: las variables las inyecta el despliegue.
      ignoreEnvFile: process.env['NODE_ENV'] === 'production',
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env['LOG_LEVEL'] ?? 'info',
        // Un identificador por peticion, que sigue al error hasta el cliente.
        genReqId: (peticion) => {
          const cabecera = peticion.headers[CABECERA_ID_CORRELACION];
          return typeof cabecera === 'string' && cabecera.length > 0
            ? cabecera
            : generarIdCorrelacion();
        },
        // Nada de cuerpos ni cabeceras de autorizacion en los logs: la
        // plataforma es «Informacion Publico Clasificado».
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body'],
          remove: true,
        },
      },
    }),
    SaludModule,
  ],
})
export class AppModule {}

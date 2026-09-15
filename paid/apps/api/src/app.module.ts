import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { validarConfiguracion } from './configuracion';
import { SaludModule } from './salud/salud.module';
import { BaseDatosModule } from './basedatos/basedatos.module';
import { SeguridadModule } from './seguridad/seguridad.module';
import { SesionGuard } from './seguridad/sesion.guard';
import { PermisoGuard } from './seguridad/permiso.guard';
import { TransaccionInterceptor } from './seguridad/transaccion.interceptor';
import { TareasModule } from './tareas/tareas.module';
import { AlianzasModule } from './alianzas/alianzas.module';
import { AlmacenModule } from './almacen/almacen.module';
import { JornadasModule } from './jornadas/jornadas.module';
import { CABECERA_ID_CORRELACION, generarIdCorrelacion } from './comun/id-correlacion';

/**
 * Modulo raiz.
 *
 * ⚠️ El orden de los tres elementos globales de abajo NO es indiferente:
 *
 *   1. `SesionGuard`  valida el testigo y desplaza la expiracion (R1). Deja la
 *      sesion en la peticion.
 *   2. `PermisoGuard` lee esa sesion y comprueba el permiso (P4, R16). Sin el
 *      paso 1 no tendria nada que leer.
 *   3. `TransaccionInterceptor` abre la transaccion con el contexto de R7.
 *      Corre despues de los guardas, que es lo correcto: no tiene sentido
 *      abrir una transaccion para una peticion que va a recibir 401.
 *
 * NestJS ejecuta los guardas en el orden de declaracion y los interceptores
 * despues de los guardas, asi que este orden se obtiene declarandolos asi.
 *
 * Lo que todavia no esta:
 * - Modulos de dominio (jornadas, asistencias...): Fase 3.
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
    BaseDatosModule,
    SeguridadModule,
    TareasModule,
    AlmacenModule,
    JornadasModule,
    AlianzasModule,
    SaludModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: SesionGuard },
    { provide: APP_GUARD, useClass: PermisoGuard },
    { provide: APP_INTERCEPTOR, useClass: TransaccionInterceptor },
  ],
})
export class AppModule {}

import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ALMACEN_OBJETOS } from './almacen';
import type { AlmacenObjetos } from './almacen';
import { AlmacenMinio } from './almacen-minio';
import { AlmacenSistemaArchivos } from './almacen-sistema-archivos';

/**
 * Elige la implementacion del almacen.
 *
 * `PAID_ALMACEN=minio` es lo correcto en despliegue. El valor por omision es el
 * sistema de archivos, porque es lo que funciona sin infraestructura y no
 * relaja ninguna regla (ver `almacen.ts`).
 *
 * En `NODE_ENV=production` con el almacen de archivos se AVISA de forma
 * llamativa: es un almacen sin replicacion ni retencion, y los soportes de una
 * actividad son parte del expediente.
 */
@Global()
@Module({
  providers: [
    {
      provide: ALMACEN_OBJETOS,
      inject: [ConfigService],
      useFactory: async (configuracion: ConfigService): Promise<AlmacenObjetos> => {
        const registro = new Logger('AlmacenModule');
        const clase = configuracion.get<string>('PAID_ALMACEN') ?? 'sistema-archivos';

        if (clase === 'minio') {
          const almacen = new AlmacenMinio({
            endPoint: configuracion.get<string>('MINIO_ENDPOINT') ?? 'localhost',
            port: configuracion.get<number>('MINIO_PORT') ?? 9000,
            useSSL: configuracion.get<string>('MINIO_USE_SSL') === 'true',
            accessKey: configuracion.get<string>('MINIO_ACCESS_KEY') ?? '',
            secretKey: configuracion.get<string>('MINIO_SECRET_KEY') ?? '',
            bucket: configuracion.get<string>('MINIO_BUCKET') ?? 'paid-adjuntos',
          });
          await almacen.asegurarBucket();
          return almacen;
        }

        if (configuracion.get<string>('NODE_ENV') === 'production') {
          registro.warn(
            'ALMACEN DE ARCHIVOS LOCAL EN PRODUCCION. Los soportes son parte del ' +
              'expediente y este almacen no tiene replicacion ni retencion. ' +
              'Configure PAID_ALMACEN=minio.',
          );
        }
        const raiz =
          configuracion.get<string>('PAID_ALMACEN_RAIZ') ?? '/tmp/paid-adjuntos';
        return new AlmacenSistemaArchivos(raiz);
      },
    },
  ],
  exports: [ALMACEN_OBJETOS],
})
export class AlmacenModule {}

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Client } from 'minio';
import type { AlmacenObjetos, ObjetoGuardado } from './almacen';

/**
 * Almacen en MinIO, compatible con S3, desplegado DENTRO de la intranet (A.1).
 *
 * ⚠️ ESTA IMPLEMENTACION NO ESTA VERIFICADA.
 *
 * `dl.min.io` y el registro de imagenes de Docker estan bloqueados por la
 * politica de egreso de la sesion en la que se escribio, asi que no fue posible
 * levantar un MinIO contra el que probarla. El codigo esta escrito y compila;
 * lo que falta es haberlo ejecutado.
 *
 * Es la misma clase de pendiente que `docker compose up` (D-07), y la primera
 * cosa que conviene comprobar en un entorno con acceso:
 *
 *   docker compose up -d minio
 *   PAID_ALMACEN=minio pnpm --filter @paid/api test
 *
 * Las reglas de los adjuntos no dependen de esto: R11 y R12 se imponen antes
 * de que el almacen vea un byte, y se verifican con el almacen de sistema de
 * archivos. Ver docs/DECISIONES.md, D-22.
 */
export interface OpcionesMinio {
  readonly endPoint: string;
  readonly port: number;
  readonly useSSL: boolean;
  readonly accessKey: string;
  readonly secretKey: string;
  readonly bucket: string;
}

@Injectable()
export class AlmacenMinio implements AlmacenObjetos {
  readonly clase = 'minio' as const;
  private readonly registro = new Logger(AlmacenMinio.name);
  private readonly cliente: Client;
  private readonly bucket: string;

  constructor(opciones: OpcionesMinio) {
    this.cliente = new Client({
      endPoint: opciones.endPoint,
      port: opciones.port,
      useSSL: opciones.useSSL,
      accessKey: opciones.accessKey,
      secretKey: opciones.secretKey,
    });
    this.bucket = opciones.bucket;
  }

  /** Crea el bucket si no existe. Se llama al arrancar. */
  async asegurarBucket(): Promise<void> {
    const existe = await this.cliente.bucketExists(this.bucket);
    if (!existe) {
      await this.cliente.makeBucket(this.bucket);
      this.registro.log({ bucket: this.bucket }, 'Bucket creado');
    }
  }

  async guardar(ruta: string, contenido: Buffer, tipoMime: string): Promise<ObjetoGuardado> {
    const hashSha256 = createHash('sha256').update(contenido).digest('hex');
    await this.cliente.putObject(this.bucket, ruta, contenido, contenido.byteLength, {
      'Content-Type': tipoMime,
      // El resumen viaja como metadato para poder comprobar la integridad del
      // objeto sin volver a leerlo entero.
      'x-amz-meta-sha256': hashSha256,
    });
    return { ruta, pesoBytes: contenido.byteLength, hashSha256 };
  }

  async leer(ruta: string): Promise<Buffer> {
    const flujo = await this.cliente.getObject(this.bucket, ruta);
    const trozos: Buffer[] = [];
    for await (const trozo of flujo) {
      trozos.push(trozo as Buffer);
    }
    return Buffer.concat(trozos);
  }

  async eliminar(ruta: string): Promise<void> {
    await this.cliente.removeObject(this.bucket, ruta);
  }

  async existe(ruta: string): Promise<boolean> {
    try {
      await this.cliente.statObject(this.bucket, ruta);
      return true;
    } catch {
      return false;
    }
  }
}

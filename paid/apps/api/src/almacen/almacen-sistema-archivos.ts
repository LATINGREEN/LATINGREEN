import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import type { AlmacenObjetos, ObjetoGuardado } from './almacen';

/**
 * Almacen sobre el sistema de archivos. Para desarrollo y pruebas.
 *
 * No es un simulacro: escribe y lee de verdad, calcula el resumen de verdad y
 * respeta las mismas rutas que MinIO. Lo que no tiene es replicacion ni
 * politicas de retencion, y por eso no es para produccion.
 */
@Injectable()
export class AlmacenSistemaArchivos implements AlmacenObjetos {
  readonly clase = 'sistema-archivos' as const;
  private readonly raiz: string;

  constructor(raiz: string) {
    this.raiz = resolve(raiz);
  }

  /**
   * Resuelve una ruta relativa DENTRO de la raiz.
   *
   * La comprobacion no es decorativa: la ruta se compone con datos del
   * servidor, pero incluye el nombre del archivo que subio el usuario. Un
   * `../../etc/passwd` por ahi escribiria fuera del almacen.
   */
  private rutaFisica(ruta: string): string {
    const completa = resolve(join(this.raiz, normalize(ruta)));
    if (completa !== this.raiz && !completa.startsWith(this.raiz + sep)) {
      throw new Error(`Ruta de objeto fuera del almacen: ${ruta}`);
    }
    return completa;
  }

  async guardar(ruta: string, contenido: Buffer, _tipoMime: string): Promise<ObjetoGuardado> {
    const destino = this.rutaFisica(ruta);
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, contenido);
    return {
      ruta,
      pesoBytes: contenido.byteLength,
      hashSha256: createHash('sha256').update(contenido).digest('hex'),
    };
  }

  async leer(ruta: string): Promise<Buffer> {
    return readFile(this.rutaFisica(ruta));
  }

  async eliminar(ruta: string): Promise<void> {
    await rm(this.rutaFisica(ruta), { force: true });
  }

  async existe(ruta: string): Promise<boolean> {
    try {
      await stat(this.rutaFisica(ruta));
      return true;
    } catch {
      return false;
    }
  }
}

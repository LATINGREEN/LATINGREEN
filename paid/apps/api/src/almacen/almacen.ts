/**
 * Almacen de objetos: donde vive el binario de un adjunto.
 *
 * ⚠️ Es una INTERFAZ con dos implementaciones, y el motivo importa:
 *
 *   1. En despliegue, MinIO dentro del propio despliegue (A.1).
 *   2. En desarrollo y pruebas, el sistema de archivos local.
 *
 * Que exista la segunda NO relaja ninguna regla. Las reglas de los adjuntos
 * —la cuota AGREGADA de 10 MB (R11) y la validacion del MIME real (R12)— se
 * imponen en la base y en `AdjuntosService`, **antes** de que el almacen vea un
 * solo byte. El almacen solo guarda y devuelve. De modo que R11 y R12 se
 * verifican igual con cualquiera de las dos, que es lo que permite probarlas de
 * verdad sin un MinIO a mano.
 *
 * Ver docs/DECISIONES.md, D-22.
 */
export interface ObjetoGuardado {
  readonly ruta: string;
  readonly pesoBytes: number;
  readonly hashSha256: string;
}

export interface AlmacenObjetos {
  /** Guarda el contenido y devuelve su ruta, peso y resumen. */
  guardar(ruta: string, contenido: Buffer, tipoMime: string): Promise<ObjetoGuardado>;
  leer(ruta: string): Promise<Buffer>;
  /**
   * Retira un objeto del almacen.
   *
   * ⚠️ NO se llama desde el borrado logico de un adjunto (R14): dar de baja
   * una fila no destruye el binario, porque el borrado fisico exige una
   * solicitud aprobada por JACID. Existe para esa aprobacion y para deshacer
   * una carga que fallo despues de escribir.
   */
  eliminar(ruta: string): Promise<void>;
  existe(ruta: string): Promise<boolean>;
  /** Nombre de la implementacion, para la sonda de salud y los logs. */
  readonly clase: 'minio' | 'sistema-archivos';
}

export const ALMACEN_OBJETOS = Symbol('ALMACEN_OBJETOS');

import { BadRequestException, Inject, Injectable, PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import { fromBuffer } from 'file-type';
import {
  CODIGOS_ERROR,
  CUOTA_BYTES_POR_ACTIVIDAD,
  categoriaDeExtension,
  extensionDe,
  formatearBytes,
} from '@paid/schema';
import type { EstadoCuota, FaseDocumental } from '@paid/schema';
import { createHash } from 'node:crypto';
import { BaseDatosService } from '../basedatos/basedatos.service';
import { ALMACEN_OBJETOS } from '../almacen/almacen';
import type { AlmacenObjetos } from '../almacen/almacen';

/**
 * Adjuntos de una actividad. Aqui viven R11 y R12 del lado del servicio.
 *
 * ⚠️ El ORDEN de las comprobaciones importa, y es este:
 *
 *   1. La extension esta permitida (R12).
 *   2. El CONTENIDO REAL corresponde a esa extension (R12).
 *   3. El archivo CABE en la cuota agregada de la actividad (R11).
 *   4. Recien entonces se escribe en el almacen.
 *   5. Y la fila en la base, donde el disparador vuelve a comprobar la cuota.
 *
 * El paso 3 antes del 4 es lo que evita escribir un binario que la base va a
 * rechazar: un objeto huerfano en MinIO que nadie sabe que esta ahi. El paso 5
 * no es redundante: la comprobacion del servicio y la del disparador pueden
 * discrepar por una carga simultanea, y la que manda es la de la base.
 */
export interface AdjuntoGuardado {
  readonly id: number;
  readonly nombreArchivo: string;
  readonly extension: string;
  readonly categoria: string;
  readonly mimeDetectado: string;
  readonly pesoBytes: number;
  readonly hashSha256: string;
  readonly faseDocumental: number;
  readonly cuota: EstadoCuota;
}

@Injectable()
export class AdjuntosService {
  constructor(
    private readonly baseDatos: BaseDatosService,
    @Inject(ALMACEN_OBJETOS) private readonly almacen: AlmacenObjetos,
  ) {}

  /**
   * Consumo acumulado de una actividad.
   *
   * R11 exige que la interfaz lo muestre **antes** de que el usuario intente
   * subir. De ahi que esto sea un metodo publico con su endpoint, y no un
   * calculo interno de la carga: el usuario tiene que poder ver que le queda
   * sin gastar un intento.
   */
  async consultarCuota(idActividad: number): Promise<EstadoCuota> {
    const resultado = await this.baseDatos.cliente.query<{ bytes: string }>(
      `SELECT COALESCE(SUM(peso_bytes), 0)::text AS bytes
         FROM ai.act_adjunto a
         JOIN ref.estado_registro e ON e.id = a.id_estado_registro
        WHERE a.id_actividad = $1 AND e.codigo = 'ACTIVO'`,
      [idActividad],
    );
    const bytesUsados = Number(resultado.rows[0]?.bytes ?? 0);
    const bytesDisponibles = Math.max(0, CUOTA_BYTES_POR_ACTIVIDAD - bytesUsados);
    return {
      bytesUsados,
      bytesDisponibles,
      porcentajeUsado: Math.round((bytesUsados / CUOTA_BYTES_POR_ACTIVIDAD) * 1000) / 10,
    };
  }

  /**
   * R12 — Se valida contra el CONTENIDO REAL, no contra la extension
   * declarada.
   *
   * Renombrar `programa.exe` a `foto.jpg` no debe bastar, y no basta: se leen
   * los primeros bytes y se compara el MIME detectado con el que la extension
   * promete, usando el catalogo `ref.extension_permitida` —no una lista en el
   * codigo—, de modo que JACID puede ajustarlo sin desplegar.
   */
  private async detectarYValidarMime(
    nombreArchivo: string,
    contenido: Buffer,
  ): Promise<{ extension: string; mime: string; idCategoria: number; idExtension: number }> {
    const extension = extensionDe(nombreArchivo);
    if (extension === '') {
      throw new UnsupportedMediaTypeException({
        codigo: CODIGOS_ERROR.TIPO_ARCHIVO_NO_PERMITIDO,
        mensaje: 'El archivo no tiene extensión.',
      });
    }

    const permitida = await this.baseDatos.cliente.query<{
      id: number;
      id_categoria_adjunto: number;
      mimes_esperados: string[];
    }>(
      `SELECT id, id_categoria_adjunto, mimes_esperados
         FROM ref.extension_permitida
        WHERE extension = $1 AND activo`,
      [extension],
    );
    const fila = permitida.rows[0];
    if (fila === undefined) {
      throw new UnsupportedMediaTypeException({
        codigo: CODIGOS_ERROR.TIPO_ARCHIVO_NO_PERMITIDO,
        mensaje: `La extensión «${extension}» no está permitida.`,
      });
    }

    const detectado = await fromBuffer(contenido);

    /*
     * Un tipo que no se puede detectar por su contenido NO se acepta a la
     * ligera, pero tampoco se rechaza siempre: los formatos de texto plano no
     * tienen numero magico. De las 16 extensiones permitidas, ninguna es de
     * texto plano, asi que aqui «no detectado» es un rechazo.
     */
    if (detectado === undefined) {
      throw new UnsupportedMediaTypeException({
        codigo: CODIGOS_ERROR.TIPO_ARCHIVO_NO_PERMITIDO,
        mensaje:
          'No se pudo reconocer el contenido del archivo. Verifique que no esté dañado.',
      });
    }

    const mimeReal = detectado.mime.toLowerCase();
    if (!fila.mimes_esperados.map((m) => m.toLowerCase()).includes(mimeReal)) {
      throw new UnsupportedMediaTypeException({
        codigo: CODIGOS_ERROR.TIPO_ARCHIVO_NO_PERMITIDO,
        mensaje:
          `El contenido del archivo no corresponde a la extensión «${extension}». ` +
          `Se detectó «${mimeReal}».`,
      });
    }

    return {
      extension,
      mime: mimeReal,
      idCategoria: fila.id_categoria_adjunto,
      idExtension: fila.id,
    };
  }

  async cargar(
    idActividad: number,
    archivo: { nombreArchivo: string; contenido: Buffer },
    faseDocumental: FaseDocumental,
  ): Promise<AdjuntoGuardado> {
    if (archivo.contenido.byteLength === 0) {
      throw new BadRequestException({
        codigo: CODIGOS_ERROR.DATOS_INVALIDOS,
        mensaje: 'El archivo está vacío.',
      });
    }

    // Pasos 1 y 2: R12.
    const tipo = await this.detectarYValidarMime(archivo.nombreArchivo, archivo.contenido);

    // Paso 3: R11, ANTES de escribir nada en el almacen.
    const cuota = await this.consultarCuota(idActividad);
    if (archivo.contenido.byteLength > cuota.bytesDisponibles) {
      throw new PayloadTooLargeException({
        codigo: CODIGOS_ERROR.CUOTA_ADJUNTOS_AGOTADA,
        mensaje:
          `La actividad ya usa ${formatearBytes(cuota.bytesUsados)} de los ` +
          `${formatearBytes(CUOTA_BYTES_POR_ACTIVIDAD)} disponibles. ` +
          `Este archivo pesa ${formatearBytes(archivo.contenido.byteLength)} y no cabe. ` +
          'La cuota de 10 MB es del total de la actividad, no de cada archivo.',
        detalles: { cuota },
      });
    }

    const hashSha256 = createHash('sha256').update(archivo.contenido).digest('hex');
    const ruta = `actividades/${idActividad}/${hashSha256}.${tipo.extension}`;

    // Paso 4: el almacen.
    await this.almacen.guardar(ruta, archivo.contenido, tipo.mime);

    // Paso 5: la fila. El disparador de la base vuelve a comprobar la cuota, y
    // si la carga simultanea de otro archivo la agoto entre el paso 3 y aqui,
    // esta insercion falla — y entonces hay que retirar el objeto que acabamos
    // de escribir, o queda huerfano.
    try {
      const insertada = await this.baseDatos.cliente.query<{ id: string }>(
        `INSERT INTO ai.act_adjunto (
           id_actividad, nombre_archivo, extension, id_categoria_adjunto,
           mime_detectado, peso_bytes, hash_sha256, ruta_objeto,
           id_fase_documental, id_estado_registro)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
           (SELECT id FROM ref.fase_documental WHERE codigo = $9),
           (SELECT id FROM ref.estado_registro WHERE codigo = 'ACTIVO'))
         RETURNING id`,
        [
          idActividad,
          archivo.nombreArchivo,
          tipo.extension,
          tipo.idCategoria,
          tipo.mime,
          archivo.contenido.byteLength,
          hashSha256,
          ruta,
          `FASE_${faseDocumental}`,
        ],
      );

      return {
        id: Number(insertada.rows[0]?.id),
        nombreArchivo: archivo.nombreArchivo,
        extension: tipo.extension,
        categoria: categoriaDeExtension(tipo.extension) ?? 'DOCUMENTO',
        mimeDetectado: tipo.mime,
        pesoBytes: archivo.contenido.byteLength,
        hashSha256,
        faseDocumental,
        cuota: await this.consultarCuota(idActividad),
      };
    } catch (error: unknown) {
      /*
       * La fila no entro. Se retira el objeto para no dejar un binario
       * huerfano — «un adjunto huerfano» es el primero de los defectos que
       * PROMPT.md nombra en su advertencia final, precisamente porque no lanza
       * ningun error.
       *
       * Si el propio borrado falla, se propaga el error original: es el que
       * explica que paso.
       */
      await this.almacen.eliminar(ruta).catch(() => undefined);
      throw error;
    }
  }

  /** R14 — Baja logica. El binario NO se destruye. */
  async darDeBaja(idAdjunto: number): Promise<void> {
    await this.baseDatos.cliente.query(
      `UPDATE ai.act_adjunto
          SET id_estado_registro = (SELECT id FROM ref.estado_registro WHERE codigo = 'INACTIVO')
        WHERE id = $1`,
      [idAdjunto],
    );
  }

  async leer(idAdjunto: number): Promise<{ nombre: string; mime: string; contenido: Buffer }> {
    const fila = await this.baseDatos.cliente.query<{
      nombre_archivo: string;
      mime_detectado: string;
      ruta_objeto: string;
      hash_sha256: string;
    }>(
      `SELECT nombre_archivo, mime_detectado, ruta_objeto, hash_sha256
         FROM ai.act_adjunto WHERE id = $1`,
      [idAdjunto],
    );
    const adjunto = fila.rows[0];
    if (adjunto === undefined) {
      throw new BadRequestException({
        codigo: CODIGOS_ERROR.RECURSO_NO_ENCONTRADO,
        mensaje: 'No se encontró el adjunto.',
      });
    }

    const contenido = await this.almacen.leer(adjunto.ruta_objeto);

    /*
     * Se comprueba el resumen al leer. Si el binario del almacen no coincide
     * con el que se guardo, el soporte esta corrupto o fue alterado, y
     * entregarlo como si nada seria entregar un documento que no es el que se
     * adjunto. Es un soporte de un expediente.
     */
    const hashActual = createHash('sha256').update(contenido).digest('hex');
    if (hashActual !== adjunto.hash_sha256) {
      throw new BadRequestException({
        codigo: CODIGOS_ERROR.INTERNO,
        mensaje:
          'El contenido del soporte no coincide con el resumen registrado al adjuntarlo. ' +
          'No se entrega. Reporte la incidencia.',
      });
    }

    return {
      nombre: adjunto.nombre_archivo,
      mime: adjunto.mime_detectado,
      contenido,
    };
  }
}

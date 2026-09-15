import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CODIGOS_ERROR } from '@paid/schema';
import type { RespuestaError } from '@paid/schema';
import { CABECERA_ID_CORRELACION, generarIdCorrelacion } from './id-correlacion';

/**
 * Respuesta de error uniforme `{ codigo, mensaje, detalles?, idCorrelacion }`
 * (PROMPT.md Fase 3, punto 5).
 *
 * Dos cosas importan aqui:
 *
 * 1. El cuerpo que sale al cliente **nunca** lleva el detalle interno de una
 *    excepcion no controlada. El detalle va al log, asociado al mismo
 *    `idCorrelacion`.
 * 2. R4: la pantalla de ingreso siempre dice lo mismo. Ese mensaje unico se
 *    construye en el modulo de autenticacion (Fase 2); este filtro solo se
 *    encarga de no filtrar informacion por accidente.
 */
/**
 * Codigo de dominio que corresponde a un estado HTTP. Existe para que el
 * cliente pueda ramificar por `codigo` sin leer el `mensaje`, que es texto
 * para personas y puede cambiar de redaccion.
 */
function codigoParaEstado(estado: number): string {
  switch (estado) {
    case HttpStatus.UNAUTHORIZED:
    case HttpStatus.FORBIDDEN:
      // R2/R6: red no autorizada o fuera de ambito. El detalle de la causa se
      // queda en `seg.intento_autenticacion`, no viaja al cliente (R4).
      return CODIGOS_ERROR.ACCESO_DENEGADO;
    case HttpStatus.NOT_FOUND:
      return CODIGOS_ERROR.RECURSO_NO_ENCONTRADO;
    case HttpStatus.CONFLICT:
      return CODIGOS_ERROR.CONFLICTO;
    case HttpStatus.PAYLOAD_TOO_LARGE:
      // R11: la cuota agregada de 10 MB de la actividad.
      return CODIGOS_ERROR.CUOTA_ADJUNTOS_AGOTADA;
    case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
      // R12: el contenido real no corresponde a la extension declarada.
      return CODIGOS_ERROR.TIPO_ARCHIVO_NO_PERMITIDO;
    default:
      return estado >= 500 ? CODIGOS_ERROR.INTERNO : CODIGOS_ERROR.DATOS_INVALIDOS;
  }
}

@Catch()
export class FiltroExcepciones implements ExceptionFilter {
  private readonly registro = new Logger(FiltroExcepciones.name);

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const contexto = host.switchToHttp();
    const respuesta = contexto.getResponse<Response>();
    const peticion = contexto.getRequest<Request>();

    const cabecera = peticion.headers[CABECERA_ID_CORRELACION];
    const idCorrelacion =
      typeof cabecera === 'string' && cabecera.length > 0 ? cabecera : generarIdCorrelacion();

    if (excepcion instanceof HttpException) {
      const estado = excepcion.getStatus();
      /*
       * ⚠️ R4 depende de esto.
       *
       * Cuando se lanza `new UnauthorizedException({ codigo, mensaje })`,
       * NestJS guarda ese objeto como «respuesta» y pone en `.message` el
       * texto por omision, «Unauthorized Exception». Si el filtro usara
       * `.message`, el cuerpo que ve el cliente seria ese texto en ingles y
       * NO «Credenciales invalidas» — es decir, R4 quedaria incumplido
       * mientras el codigo que lo impone parecia correcto.
       *
       * Asi que manda el cuerpo que la excepcion trae, y `.message` solo se
       * usa cuando no trae ninguno (las excepciones que NestJS lanza por su
       * cuenta, como el 404 de una ruta inexistente).
       */
      const contenido = excepcion.getResponse();
      const personalizado =
        typeof contenido === 'object' && contenido !== null
          ? (contenido as { codigo?: unknown; mensaje?: unknown; detalles?: unknown })
          : undefined;

      const cuerpo: RespuestaError = {
        codigo:
          typeof personalizado?.codigo === 'string'
            ? personalizado.codigo
            : codigoParaEstado(estado),
        mensaje:
          typeof personalizado?.mensaje === 'string'
            ? personalizado.mensaje
            : excepcion.message,
        ...(personalizado?.detalles !== undefined ? { detalles: personalizado.detalles } : {}),
        idCorrelacion,
      };
      respuesta.status(estado).json(cuerpo);
      return;
    }

    /*
     * No controlada: al log TODO, al cliente nada.
     *
     * El mensaje y la pila se extraen a mano. Pasar el `Error` como propiedad
     * de un objeto lo serializa como `{}` —las propiedades de `Error` no son
     * enumerables— y el log queda inservible justo cuando mas se necesita.
     */
    const detalle =
      excepcion instanceof Error
        ? { mensaje: excepcion.message, pila: excepcion.stack, tipo: excepcion.name }
        : { mensaje: String(excepcion), tipo: typeof excepcion };

    this.registro.error(
      { idCorrelacion, ruta: peticion.url, metodo: peticion.method, ...detalle },
      `Excepcion no controlada: ${detalle.mensaje}`,
    );
    const cuerpo: RespuestaError = {
      codigo: CODIGOS_ERROR.INTERNO,
      mensaje: 'Ocurrió un error interno. Cite el identificador de correlación al reportarlo.',
      idCorrelacion,
    };
    respuesta.status(HttpStatus.INTERNAL_SERVER_ERROR).json(cuerpo);
  }
}

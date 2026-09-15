import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
} from '@nestjs/common';
import { z } from 'zod';
import { CODIGOS_ERROR } from '@paid/schema';
import { BaseDatosService } from '../basedatos/basedatos.service';
import { RequierePermiso } from '../seguridad/requiere-permiso.decorator';

/**
 * R16 — «El **porcentaje de avance de un convenio** solo lo diligencia JACID
 * (permiso `ALIANZA.AVANCE`).»
 *
 * Este controlador existe para que esa frase tenga un sitio donde ser cierta.
 * Es deliberadamente pequeno: el modulo completo de alianzas y convenios es de
 * la Fase 3. Lo que esta aqui es la atribucion de R16 y su lectura.
 *
 * Todas las consultas van dentro de la transaccion con contexto que abre
 * `TransaccionInterceptor` (R7), asi que RLS filtra por unidad sin que este
 * codigo tenga que poner un `WHERE id_unidad = ...`. Si se le anadiera, seria
 * redundante; si RLS faltara, ese `WHERE` seria la unica defensa, que es
 * exactamente lo que R6 prohibe.
 */
const cambioAvance = z.object({
  porcentajeAvance: z.number().int().min(0).max(100),
});

interface FilaAlianza {
  readonly id: string;
  readonly codigo: string;
  readonly tipo: string;
  readonly objeto: string;
  readonly porcentaje_avance: number | null;
}

@Controller('alianzas')
export class AlianzasController {
  constructor(private readonly baseDatos: BaseDatosService) {}

  @RequierePermiso('ALIANZA.CONSULTAR')
  @Get()
  async listar(): Promise<readonly FilaAlianza[]> {
    const resultado = await this.baseDatos.cliente.query<FilaAlianza>(
      `SELECT a.id, a.codigo, t.codigo AS tipo, a.objeto, a.porcentaje_avance
         FROM ai.alianza a
         JOIN ref.tipo_alianza t ON t.id = a.id_tipo_alianza
        ORDER BY a.fecha_suscripcion DESC`,
    );
    return resultado.rows;
  }

  /**
   * R16. El permiso `ALIANZA.AVANCE` lo tienen solo ADMINISTRADOR y
   * FUNCIONAL_JACID en la matriz sembrada, asi que `OPERADOR_UNIDAD` recibe
   * 403 aqui. Es lo que comprueba la Puerta 2.
   *
   * Que el permiso sea insuficiente por si solo es deliberado: la base ademas
   * exige que el registro sea un CONVENIO y que el avance no retroceda. Tres
   * capas para una regla que el manual expresa en una linea, porque es la
   * clase de dato que acaba en una rendicion de cuentas.
   */
  @RequierePermiso('ALIANZA.AVANCE')
  @Patch(':id/avance')
  async cambiarAvance(
    @Param('id') id: string,
    @Body() cuerpo: unknown,
  ): Promise<{ id: number; porcentajeAvance: number }> {
    const validado = cambioAvance.safeParse(cuerpo);
    if (!validado.success) {
      throw new BadRequestException({
        codigo: CODIGOS_ERROR.DATOS_INVALIDOS,
        mensaje: 'El porcentaje de avance debe ser un entero entre 0 y 100.',
      });
    }

    const resultado = await this.baseDatos.cliente.query<{
      id: string;
      porcentaje_avance: number;
    }>(
      `UPDATE ai.alianza
          SET porcentaje_avance = $2, avance_actualizado_en = now()
        WHERE id = $1
        RETURNING id, porcentaje_avance`,
      [id, validado.data.porcentajeAvance],
    );

    const fila = resultado.rows[0];
    if (fila === undefined) {
      // RLS pudo ocultarla: para el usuario, «no existe» y «no la puede ver»
      // son lo mismo, y deben responder lo mismo. Decir «existe pero no es
      // tuya» confirmaria la existencia de datos de otra unidad.
      throw new NotFoundException({
        codigo: CODIGOS_ERROR.RECURSO_NO_ENCONTRADO,
        mensaje: 'No se encontró el registro.',
      });
    }
    return { id: Number(fila.id), porcentajeAvance: fila.porcentaje_avance };
  }
}

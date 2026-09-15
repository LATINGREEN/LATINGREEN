import { Injectable } from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';
import { CAPTCHA_TTL_SEGUNDOS } from '@paid/schema';
import type { RetoCaptcha } from '@paid/schema';
import type { PoolClient } from 'pg';

/**
 * R3 — Captcha de un solo uso.
 *
 *   - Cada ingreso lo exige.
 *   - Se guarda el **resumen** del reto, no el texto.
 *   - Caduca a los 5 minutos.
 *   - Se marca consumido al validarse **con independencia del resultado**.
 *
 * Esa ultima condicion es la que lo convierte en «de un solo uso»: si solo se
 * marcara al acertar, el mismo reto admitiria intentos infinitos y el captcha
 * no limitaria nada.
 */
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class CaptchaService {
  /**
   * Genera un reto aritmetico sencillo.
   *
   * TODO(JACID): el manual muestra un captcha de imagen. Este es un sustituto
   * textual explicito: funciona, es accesible —una imagen sin alternativa
   * incumpliria WCAG 2.1 AA, que la Fase 4 debe cumplir— y no depende de
   * ninguna biblioteca que llame a internet (A.2.1). Si JACID exige el captcha
   * de imagen del manual, se reemplaza este generador sin tocar el resto del
   * flujo.
   */
  private generarReto(): { texto: string; respuesta: string } {
    const a = randomInt(2, 20);
    const b = randomInt(2, 20);
    // Suma y resta, nunca con resultado negativo: un captcha que confunde al
    // usuario legitimo no cumple su funcion.
    if (randomInt(0, 2) === 0) {
      return { texto: `${a} + ${b} = ?`, respuesta: String(a + b) };
    }
    const mayor = Math.max(a, b);
    const menor = Math.min(a, b);
    return { texto: `${mayor} - ${menor} = ?`, respuesta: String(mayor - menor) };
  }

  /** Resumen de la respuesta esperada. En la base NO queda el texto. */
  private resumir(respuesta: string): string {
    return createHash('sha256').update(respuesta.trim().toLowerCase()).digest('hex');
  }

  async emitir(cliente: PoolClient, direccionIp: string): Promise<RetoCaptcha> {
    const reto = this.generarReto();
    const resultado = await cliente.query<{ id: string; expira_en: Date }>(
      `INSERT INTO seg.captcha (hash_reto, direccion_ip)
       VALUES ($1, $2) RETURNING id, expira_en`,
      [this.resumir(reto.respuesta), direccionIp],
    );
    const fila = resultado.rows[0];
    if (fila === undefined) throw new Error('No se pudo emitir el captcha.');
    return {
      idCaptcha: fila.id,
      textoReto: reto.texto,
      expiraEnUtc: fila.expira_en.toISOString(),
    };
  }

  /**
   * Valida un reto y lo marca consumido **pase lo que pase** (R3).
   *
   * El orden importa: se marca consumido ANTES de devolver el veredicto, y en
   * la misma sentencia que lo lee. Asi dos peticiones concurrentes con el mismo
   * reto no pueden ambas considerarlo valido.
   */
  async validarYConsumir(
    cliente: PoolClient,
    idCaptcha: string,
    respuesta: string,
  ): Promise<boolean> {
    /*
     * El identificador se comprueba ANTES de llegar a la base.
     *
     * No es una optimizacion: `WHERE id = 'no-soy-un-uuid'` hace que PostgreSQL
     * aborte la sentencia, y con ella la TRANSACCION ENTERA. Todo lo que viene
     * despues —el registro del intento en `seg.intento_autenticacion`, que es
     * lo que R4 exige conservar— falla con «current transaction is aborted», y
     * el cliente recibe un 500 en lugar del 401 uniforme.
     *
     * Atraparlo con un try/catch no basta por eso mismo: la transaccion ya
     * esta perdida cuando la excepcion llega.
     */
    if (!RE_UUID.test(idCaptcha)) return false;

    // `UPDATE ... RETURNING` con la condicion de no consumido resuelve la
    // carrera: solo una peticion consigue marcarlo.
    const resultado = await cliente.query<{ hash_reto: string; vencido: boolean }>(
      `UPDATE seg.captcha
          SET consumido_en = now()
        WHERE id = $1 AND consumido_en IS NULL
        RETURNING hash_reto, (expira_en < now()) AS vencido`,
      [idCaptcha],
    );

    const fila = resultado.rows[0];
    // No existe, o ya estaba consumido: en ambos casos, invalido.
    if (fila === undefined) return false;
    if (fila.vencido) return false;
    return fila.hash_reto === this.resumir(respuesta);
  }

  /** Poda de captchas caducados. La ejecuta la tarea programada. */
  async podarCaducados(cliente: PoolClient): Promise<number> {
    const resultado = await cliente.query(
      `DELETE FROM seg.captcha
        WHERE expira_en < now() - interval '1 hour'`,
    );
    return resultado.rowCount ?? 0;
  }

  get ttlSegundos(): number {
    return CAPTCHA_TTL_SEGUNDOS;
  }
}

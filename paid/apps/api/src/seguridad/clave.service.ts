import { Injectable } from '@nestjs/common';
import { Algorithm, hash, verify } from '@node-rs/argon2';
import { CLAVES_EN_HISTORIAL } from '@paid/schema';
import type { PoolClient } from 'pg';

/**
 * Claves con **Argon2id** (PROMPT.md Fase 2, punto 2).
 *
 * Los parametros se fijan aqui y no en configuracion: un despliegue que los
 * baje «porque va lento» debilita el sistema sin que nada lo señale. Si hay
 * que cambiarlos, se cambian en el codigo, con revision.
 */
const PARAMETROS_ARGON2 = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456, // 19 MiB — recomendacion de OWASP para Argon2id
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Resumen ficticio para el camino «el usuario no existe».
 *
 * ⚠️ R4. El mensaje de la pantalla es siempre el mismo, pero eso no basta: si
 * el camino del usuario inexistente respondiera sin verificar ninguna clave,
 * un atacante podria distinguir los dos casos por el tiempo de respuesta y
 * enumerar credenciales validas.
 *
 * Asi que cuando la credencial no existe se verifica la clave recibida contra
 * **este** resumen, que nunca coincide. El trabajo criptografico es el mismo y
 * no hay nada que medir.
 *
 * La Puerta 2 lo comprueba verificando que ambos caminos EJECUTAN la
 * verificacion —no comparando tiempos, que en CI es una prueba inestable, como
 * PROMPT.md advierte expresamente.
 */
const RESUMEN_FICTICIO =
  '$argon2id$v=19$m=19456,t=2,p=1$JsLPC5jrfH7C+OJn/TTjbg$PuNqrook84sPpzTdGX33TNz14i8zbM/VMVGdYeetci0';

@Injectable()
export class ClaveService {
  /** Resumen Argon2id en formato PHC, que es lo que el CHECK de la base exige. */
  async resumir(clave: string): Promise<string> {
    return hash(clave, PARAMETROS_ARGON2);
  }

  /**
   * Verifica una clave contra un resumen. **Siempre se llama**, exista el
   * usuario o no: ver `RESUMEN_FICTICIO`.
   */
  async verificar(resumen: string, clave: string): Promise<boolean> {
    try {
      return await verify(resumen, clave);
    } catch {
      // Un resumen con formato invalido no es una coincidencia. Se traga la
      // excepcion a proposito: distinguirla hacia observable la diferencia
      // entre «hash corrupto» y «clave errada», que es justo lo que R4 evita.
      return false;
    }
  }

  /** El resumen contra el que se verifica cuando la credencial no existe (R4). */
  get resumenFicticio(): string {
    return RESUMEN_FICTICIO;
  }

  /**
   * ¿La clave nueva coincide con alguna de las ultimas 5? (Fase 2, punto 2)
   *
   * Hay que verificar una por una: Argon2 usa una sal distinta por resumen, de
   * modo que dos resumenes de la misma clave son distintos y no se pueden
   * comparar como cadenas.
   */
  async estaEnHistorial(
    cliente: PoolClient,
    idUsuario: number,
    claveNueva: string,
  ): Promise<boolean> {
    const resultado = await cliente.query<{ hash_clave: string }>(
      `SELECT hash_clave FROM seg.historial_clave
        WHERE id_usuario = $1 ORDER BY creado_en DESC LIMIT $2`,
      [idUsuario, CLAVES_EN_HISTORIAL],
    );
    for (const fila of resultado.rows) {
      if (await this.verificar(fila.hash_clave, claveNueva)) return true;
    }
    return false;
  }

  /** Registra la clave en el historial y poda a las ultimas 5. */
  async registrarEnHistorial(
    cliente: PoolClient,
    idUsuario: number,
    resumen: string,
  ): Promise<void> {
    await cliente.query(
      'INSERT INTO seg.historial_clave (id_usuario, hash_clave) VALUES ($1, $2)',
      [idUsuario, resumen],
    );
    await cliente.query(
      `DELETE FROM seg.historial_clave
        WHERE id_usuario = $1
          AND id NOT IN (
            SELECT id FROM seg.historial_clave
             WHERE id_usuario = $1 ORDER BY creado_en DESC LIMIT $2
          )`,
      [idUsuario, CLAVES_EN_HISTORIAL],
    );
  }
}

import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

/**
 * R2 — Red autorizada.
 *
 * «La autenticacion solo procede desde rangos autorizados, que viven en
 * `seg.red_autorizada` (tipo `CIDR`), **no en variables de entorno ni en el
 * codigo**: el manual advierte que el direccionamiento IP esta "pendiente" y
 * JACID debe poder cambiarlo sin desplegar.»
 *
 * La comparacion la hace PostgreSQL con el operador `>>=` de `inet`, que
 * entiende de mascaras. Hacerlo en TypeScript significaria escribir aritmetica
 * de bits para IPv4 y IPv6, y equivocarse en una mascara aqui es abrir la red.
 */
@Injectable()
export class RedService {
  async estaAutorizada(cliente: PoolClient, direccionIp: string): Promise<boolean> {
    try {
      const resultado = await cliente.query<{ autorizada: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM seg.red_autorizada
            WHERE activo
              AND rango >>= $1::inet
              AND vigente_desde <= now()
              AND (vigente_hasta IS NULL OR vigente_hasta > now())
         ) AS autorizada`,
        [direccionIp],
      );
      return resultado.rows[0]?.autorizada ?? false;
    } catch {
      // Una direccion que no es una IP valida no esta autorizada. Se trata
      // como rechazo y no como error del servidor: un cliente no debe poder
      // provocar un 500 mandando basura en una cabecera.
      return false;
    }
  }
}

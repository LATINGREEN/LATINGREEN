import { Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';

/**
 * R2 — Dice en el arranque desde dónde se acepta el ingreso.
 *
 * La PAID puede desplegarse en la Intranet ARC o en internet (D-38). En
 * internet lo normal es la red abierta (`0.0.0.0/0` y `::/0`); en la Intranet,
 * los rangos que JACID registre en `seg.red_autorizada`. Las dos son
 * configuraciones válidas, y por eso ninguna impide arrancar.
 *
 * Lo que no debe pasar es que nadie sepa cuál está en vigor: el registro del
 * arranque lo dice siempre, en una línea.
 */
export async function informarRedAutorizada(cliente: PoolClient): Promise<void> {
  const registro = new Logger('AvisoArranque');

  const resultado = await cliente.query<{ rango: string }>(
    `SELECT rango::text AS rango
       FROM seg.red_autorizada
      WHERE activo
        AND vigente_desde <= now()
        AND (vigente_hasta IS NULL OR vigente_hasta > now())
      ORDER BY rango`,
  );
  const rangos = resultado.rows.map((f) => f.rango);

  if (rangos.length === 0) {
    registro.warn(
      'R2 — seg.red_autorizada no tiene ningún rango vigente: NADIE puede ingresar. ' +
        'Para abrir la red a internet: pnpm db:seed (siembra 0.0.0.0/0 y ::/0).',
    );
    return;
  }
  if (rangos.includes('0.0.0.0/0') || rangos.includes('::/0')) {
    // En `warn` y no en `info`: es la línea que dice que cualquiera en internet
    // puede intentar entrar, y tiene que verse con cualquier nivel de registro.
    registro.warn(
      `R2 — Red abierta: se acepta el ingreso desde cualquier dirección (${rangos.join(', ')}).`,
    );
    return;
  }
  registro.log(`R2 — Red cerrada: el ingreso solo procede desde ${rangos.join(', ')}.`);
}

import { Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';

/**
 * R2 — «En desarrollo se siembra `0.0.0.0/0` con `tipo_red = 'ADMINISTRACION'`
 * y **un aviso llamativo en el arranque**.»
 *
 * Este es ese aviso. No es decorativo: un rango abierto en produccion permite
 * intentar el ingreso desde cualquier origen, y llega ahi en silencio —una
 * semilla de desarrollo ejecutada por costumbre, una base copiada de un
 * entorno a otro—. Nada falla; simplemente la red deja de estar cerrada.
 *
 * En `NODE_ENV=production` no se limita a avisar: **impide arrancar**. Un aviso
 * en un log que nadie lee no es una salvaguarda.
 */
export async function avisarSiLaRedEstaAbierta(
  cliente: PoolClient,
  entorno: string,
): Promise<void> {
  const registro = new Logger('AvisoArranque');

  const resultado = await cliente.query<{ rango: string; descripcion: string }>(
    `SELECT rango::text AS rango, descripcion
       FROM seg.red_autorizada
      WHERE activo AND (rango = '0.0.0.0/0'::cidr OR rango = '::/0'::cidr)`,
  );

  if (resultado.rowCount === 0) return;

  const rangos = resultado.rows.map((f) => f.rango).join(', ');
  const aviso = [
    '',
    '╔══════════════════════════════════════════════════════════════════════╗',
    '║  ⚠️  LA RED NO ESTÁ CERRADA                                          ║',
    '╠══════════════════════════════════════════════════════════════════════╣',
    `║  seg.red_autorizada contiene un rango abierto: ${rangos.padEnd(22)}║`,
    '║                                                                      ║',
    '║  Cualquier origen puede intentar autenticarse. R2 exige que la        ║',
    '║  autenticación proceda SOLO desde rangos autorizados.                ║',
    '║                                                                      ║',
    '║  Esto es aceptable en desarrollo y NUNCA en producción.              ║',
    '║  Para corregirlo: sustituya el rango por los CIDR reales de la        ║',
    '║  Intranet ARC (pregunta Q5 de docs/PREGUNTAS-JACID.md).               ║',
    '╚══════════════════════════════════════════════════════════════════════╝',
    '',
  ].join('\n');

  if (entorno === 'production') {
    // Un aviso en un log que nadie lee no es una salvaguarda.
    throw new Error(
      `${aviso}\nEl arranque se detiene: NODE_ENV=production con un rango de red abierto.`,
    );
  }
  registro.warn(aviso);
}

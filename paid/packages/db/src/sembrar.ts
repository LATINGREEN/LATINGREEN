import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crearPool, enTransaccionDeSistema } from './cliente';
import { archivosDeSemillas, seIncluyeDesarrollo } from './semillas';

/**
 * `pnpm db:seed`. Idempotente: cada archivo de `semillas/` usa
 * `ON CONFLICT DO NOTHING`, asi que ejecutarlo dos veces no duplica nada.
 *
 * Las semillas NO son estructura. Los valores que un disparador o un CHECK
 * citan por codigo (por ejemplo `ref.estado_registro`) viven en una migracion,
 * no aqui: una base migrada pero sin sembrar tendria disparadores que no
 * fallan y no cuentan.
 */
async function principal(): Promise<void> {
  const url = process.env['DATABASE_URL_ADMIN'] ?? process.env['DATABASE_URL'];
  if (url === undefined || url === '') {
    throw new Error('Falta DATABASE_URL_ADMIN.');
  }

  const directorio = join(__dirname, '..', 'semillas');
  const incluirDesarrollo = seIncluyeDesarrollo();
  const archivos = archivosDeSemillas(directorio, incluirDesarrollo);

  if (!incluirDesarrollo) {
    process.stdout.write(
      'Semillas de desarrollo OMITIDAS. Para incluirlas: PAID_SEMILLA_DESARROLLO=1\n',
    );
  }

  const pool = crearPool({ url, maximoConexiones: 1 });
  try {
    for (const archivo of archivos) {
      const sql = readFileSync(join(directorio, archivo), 'utf8');
      await enTransaccionDeSistema(pool, async (cliente) => {
        await cliente.query(sql);
      });
      process.stdout.write(`sembrado  ${archivo}\n`);
    }
  } finally {
    await pool.end();
  }
}

void principal().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});

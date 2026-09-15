import { join } from 'node:path';
import { crearPool } from './cliente';
import { aplicarPendientes, leerMigraciones } from './migraciones';

/**
 * `pnpm db:migrate`. Corre con el usuario ADMINISTRADOR: crea extensiones,
 * politicas RLS y disparadores, que el usuario de la aplicacion no puede.
 */
async function principal(): Promise<void> {
  const url = process.env['DATABASE_URL_ADMIN'] ?? process.env['DATABASE_URL'];
  if (url === undefined || url === '') {
    throw new Error(
      'Falta DATABASE_URL_ADMIN. Las migraciones necesitan el usuario administrador.',
    );
  }

  // El paquete compila a CommonJS, asi que `__dirname` esta disponible y
  // `import.meta` no. Desde `dist/` las migraciones quedan un nivel arriba.
  const directorio = join(__dirname, '..', 'migraciones');
  const migraciones = leerMigraciones(directorio);

  const pool = crearPool({ url, maximoConexiones: 1 });
  const cliente = await pool.connect();
  try {
    const aplicadas = await aplicarPendientes(cliente, migraciones);
    if (aplicadas.length === 0) {
      process.stdout.write('Sin migraciones pendientes.\n');
    } else {
      for (const nombre of aplicadas) {
        process.stdout.write(`aplicada  ${nombre}\n`);
      }
    }
  } finally {
    cliente.release();
    await pool.end();
  }
}

void principal().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});

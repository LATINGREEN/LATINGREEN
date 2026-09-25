import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * A.2.1 — La aplicacion corre unicamente en la Intranet ARC. No hay internet
 * en tiempo de ejecucion.
 *
 * Consecuencias que se ven aqui:
 *
 * - Nada de fuentes de Google ni de CDN: las fuentes se empaquetan en
 *   `public/fuentes/` y se declaran con `@font-face` local.
 * - Las teselas del mapa se sirven del propio despliegue: un PMTiles con el
 *   extracto de Colombia en `public/teselas/`, o el WMS/WMTS institucional si
 *   existe (Q11).
 * - `build.rollupOptions.external` vacio: todo se empaqueta, nada se resuelve
 *   en tiempo de ejecucion contra un origen remoto.
 */
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      /*
       * `@paid/schema` se compila a CommonJS porque apps/api (NestJS) lo
       * consume asi. Rollup no puede leer los nombres exportados a traves del
       * `export *` que TypeScript emite en CJS, de modo que aqui se resuelve el
       * paquete a su **codigo fuente** y lo compila Vite en la misma pasada.
       *
       * No es un atajo: es lo que mantiene «un solo esquema Zod para cliente y
       * servidor» (A.6) sin duplicar el paquete en dos formatos. El alias
       * apunta al mismo archivo del que `tsc` saca los tipos, asi que no hay
       * forma de que la version compilada y la usada por la interfaz difieran.
       */
      '@paid/schema': fileURLToPath(new URL('../../packages/schema/src/index.ts', import.meta.url)),
    },
  },
  /*
   * `--mode demo`: la demostración sin servidor (ver `src/demo/servidor.ts`).
   * Un solo archivo JavaScript —sin trozos cargados después— y rutas
   * relativas, para que `scripts/empaquetar-demo.mjs` lo meta todo en un único
   * HTML que se abre desde cualquier sitio.
   */
  base: mode === 'demo' ? './' : '/',
  build:
    mode === 'demo'
      ? {
          outDir: 'dist-demo',
          sourcemap: false,
          assetsInlineLimit: 100_000_000,
          chunkSizeWarningLimit: 10_000,
          rollupOptions: { external: [], output: { inlineDynamicImports: true } },
        }
      : {
          outDir: 'dist',
          sourcemap: true,
          // Sin `assetsInlineLimit` agresivo: los binarios grandes (teselas) se
          // sirven como archivo, no incrustados en el bundle.
          rollupOptions: {
            external: [],
          },
        },
  server: {
    port: Number(process.env['WEB_PUERTO'] ?? 5173),
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env['VITE_API_PROXY'] ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
}));

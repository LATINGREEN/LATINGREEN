import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * ⚠️ El transformador es SWC, no esbuild.
 *
 * NestJS resuelve sus dependencias leyendo `design:paramtypes`, la metadata
 * que TypeScript emite con `emitDecoratorMetadata`. **esbuild —el
 * transformador que Vitest usa por omision— no la emite**, asi que las
 * pruebas arrancaban la aplicacion con todos los constructores vacios y cada
 * peticion devolvia 500 con «Cannot read properties of undefined (reading
 * 'getAllAndOverride')».
 *
 * `tsc` si la emite, de modo que la compilacion y el despliegue nunca
 * estuvieron afectados: era solo el camino de las pruebas. SWC la emite
 * tambien, y es el transformador que la documentacion de NestJS recomienda
 * para Vitest.
 */
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Las pruebas levantan la API completa contra Postgres y Redis reales.
    testTimeout: 120_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});

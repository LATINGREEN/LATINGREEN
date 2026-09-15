import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Las pruebas levantan un esquema completo contra Postgres real.
    testTimeout: 120_000,
    hookTimeout: 180_000,
    // Una sola base desechable compartida: los archivos no pueden correr en
    // paralelo sin pisarse.
    fileParallelism: false,
  },
});

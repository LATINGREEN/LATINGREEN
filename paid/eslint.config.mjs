// @ts-check
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/dist-demo/**',
      '**/node_modules/**',
      '**/coverage/**',
      'apps/ia/**', // Python: lo cubre ruff, no eslint.
      '**/*.config.{js,mjs,cjs}',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // A.6: «`any` prohibido; si no hay alternativa, `unknown` con validacion.»
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['error', 'warn'] }],
    },
  },
  {
    /*
     * ⚠️ `consistent-type-imports` DESACTIVADO en apps/api, y su autocorreccion
     * seria un defecto de ejecucion, no un cambio de estilo.
     *
     * NestJS resuelve sus dependencias leyendo la metadata
     * `design:paramtypes`, que TypeScript emite a partir de los tipos de los
     * parametros del constructor. Esa metadata es una REFERENCIA AL VALOR de
     * la clase. Si el import se convierte en `import type`, TypeScript lo
     * elimina del JavaScript emitido, la metadata queda apuntando a
     * `undefined` y la inyeccion falla en tiempo de ejecucion con «Cannot read
     * properties of undefined».
     *
     * La regla no puede distinguir «este tipo solo se usa como tipo» de «este
     * tipo se usa como tipo Y NestJS necesita su valor», asi que marca
     * precisamente los archivos donde aplicarla rompe la aplicacion. Con
     * `--fix` los rompe todos de una vez, y el sintoma aparece lejos del
     * cambio.
     *
     * Lo mismo vale para cualquier paquete que use decoradores con inyeccion
     * por constructor.
     */
    files: ['apps/api/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
);

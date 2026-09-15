import { defineConfig, devices } from '@playwright/test';

/**
 * Puerta 4 — «prueba de extremo a extremo que ingresa, crea una jornada
 * completa con adjunto, la exporta y cierra sesión; más una revisión de
 * accesibilidad automatizada sin violaciones críticas».
 *
 * ⚠️ `executablePath` apunta al Chromium ya instalado en la imagen. A.2.1
 * prohíbe internet en tiempo de ejecución, y `playwright install` lo
 * descargaría: aquí se usa el que hay. Si en otro equipo la ruta no existe,
 * `PLAYWRIGHT_CHROMIUM` la sobrescribe.
 *
 * La API y la interfaz NO las levanta Playwright: las levanta
 * `scripts/mirar.sh`, que además prepara la base de datos migrada y sembrada.
 * Duplicar ese arranque aquí sería tener dos formas de poner la aplicación en
 * pie, y una de las dos se quedaría atrás.
 */
const navegador = process.env['PLAYWRIGHT_CHROMIUM'] ?? '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: './pruebas',
  // Una sola trabajadora: las pruebas comparten la base de datos sembrada y
  // el aislamiento por unidad se comprueba entrando con credenciales
  // distintas. En paralelo se pisarían la sesión.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: process.env['PAID_WEB_URL'] ?? 'http://127.0.0.1:5173',
    ...devices['Desktop Chrome'],
    launchOptions: { executablePath: navegador },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PESTANAS_CON_DATOS } from '@paid/schema';
import { ingresar, irA, resolver, salir } from './apoyo';

/**
 * 🚪 PUERTA 4 — «prueba de extremo a extremo que ingresa, crea una jornada
 * completa con adjunto, la exporta y cierra sesión».
 *
 * Recorre el camino por la INTERFAZ, no por la API: pulsando, escribiendo y
 * leyendo lo que la pantalla dice. Es la diferencia con las 80 pruebas de las
 * Puertas 2 y 3, que hablan con el servidor. Aquí se comprueba que la
 * traducción entre las dos no pierde nada — que es donde se pierden las cosas.
 *
 * Requiere la aplicación en pie: `./scripts/mirar.sh` en otra terminal.
 */

test.describe('Puerta 4 — camino completo por la interfaz', () => {
  test('ingresa, crea una jornada completa con adjunto, la exporta y cierra sesión', async ({
    page,
  }) => {
    // ── 1. Ingreso con captcha (R3) ────────────────────────────────────────
    await ingresar(page, 'BIM23_PAID');
    await expect(page.getByText('BIM23', { exact: false }).first()).toBeVisible();

    // ── 2. Datos generales de la jornada ──────────────────────────────────
    await irA(page, '/jornadas/nueva');
    await page
      .locator('#descripcion')
      .fill(
        'JORNADA DE APOYO AL DESARROLLO EN LA VEREDA LA PLAYA. Se atendieron 120 ' +
          'personas en consulta médica general, con apoyo de la alcaldía municipal. ' +
          'Se entregaron raciones alimentarias. Prueba de extremo a extremo.',
      );
    await page.locator('#fechaInicio').fill('02/03/2026');
    await page.locator('#fechaEjecucion').fill('05/03/2026');
    await page.locator('#lugar').fill('Vereda La Playa');

    // R9 — la casilla de la ARC está marcada y no se puede desmarcar.
    const casillaArc = page.locator('.arc input[type="checkbox"]');
    await expect(casillaArc).toBeChecked();
    await expect(casillaArc).toBeDisabled();

    // R18 — ninguno de los COAMI viene marcado.
    const coami = page.locator('.coami-opcion input[type="checkbox"]');
    const cuantosCoami = await coami.count();
    expect(cuantosCoami).toBeGreaterThan(0);
    for (let i = 0; i < cuantosCoami; i += 1) {
      await expect(coami.nth(i)).not.toBeChecked();
    }

    // Coordenadas GMS del Pacífico nariñense, y la conversión a decimales a la
    // vista (Fase 4, punto 5).
    await page.locator('#gms-latitudGrados').fill('1');
    await page.locator('#gms-latitudMinutos').fill('47');
    await page.locator('#gms-latitudSegundos').fill('30');
    await page.locator('#gms-longitudGrados').fill('78');
    await page.locator('#gms-longitudMinutos').fill('48');
    await page.locator('#gms-longitudSegundos').fill('45');
    /*
     * El separador decimal del proyecto es el PUNTO, no la coma, aunque la
     * convención de Colombia sea la coma: `1,234` es ambiguo —mil doscientos
     * treinta y cuatro, o uno con doscientos treinta y cuatro— y de ahí salen
     * consolidados que no cuadran. La prueba lo fija para que nadie lo
     * «arregle» a coma sin darse cuenta de lo que rompe.
     */
    await expect(page.locator('.gms-decimales')).toContainText('1.791667');
    await expect(page.locator('.gms-decimales')).toContainText('-78.812500');

    await page.getByRole('button', { name: /Guardar y continuar/ }).click();

    // Al guardar se navega a la jornada y aparecen las once pestañas.
    await expect(page.locator('.pestanas')).toBeVisible();
    const urlJornada = page.url();
    expect(urlJornada).toMatch(/\/jornadas\/\d+$/u);

    // ── 3. La rosa dice que faltan las once ───────────────────────────────
    const rosa = page.locator('.pestanas-rosa .rosa-svg');
    await expect(rosa).toHaveAttribute('aria-label', /Registro incompleto/u);

    // ── 4. Las diez pestañas de datos ─────────────────────────────────────
    for (const pestana of PESTANAS_CON_DATOS) {
      await page.locator(`.pestanas-enlace[data-pestana="${pestana}"]`).click();
      await rellenarPanel(page);
      await page.getByRole('button', { name: /Añadir registro/ }).click();
      // El aviso de «ya tiene datos» es la confirmación de que la fila entró.
      await expect(page.locator('.aviso-bien')).toBeVisible();
    }

    // ── 5. La cuota ANTES de subir nada (R11) ─────────────────────────────
    await page.locator('.pestanas-enlace[data-pestana="ARCHIVOS_ADJUNTOS"]').click();
    const medidor = page.locator('.cuota');
    await expect(medidor).toBeVisible();
    await expect(medidor).toContainText('entre todos los archivos');

    // ── 6. El adjunto (R12: el MIME real tiene que coincidir) ─────────────
    const carpeta = mkdtempSync(join(tmpdir(), 'paid-puerta4-'));
    const rutaPdf = join(carpeta, 'soporte-jornada.pdf');
    writeFileSync(rutaPdf, pdfMinimo());
    await page.locator('input[type="file"]').setInputFiles(rutaPdf);
    await page.getByRole('button', { name: /Adjuntar$/ }).click();

    // ── 7. Solo con las ONCE el registro queda completo (R19) ─────────────
    await expect(page.locator('.pestanas-rosa .rosa-svg')).toHaveAttribute(
      'aria-label',
      /Registro completo/u,
      { timeout: 15_000 },
    );

    // ── 8. El listado lo señala como completo ─────────────────────────────
    await irA(page, '/jornadas');
    await expect(page.locator('.distintivo-completo').first()).toBeVisible();

    // ── 9. La exportación ─────────────────────────────────────────────────
    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV' }).click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toMatch(/\.csv$/u);

    // ── 10. Cierre de sesión ──────────────────────────────────────────────
    await salir(page);
  });

  /**
   * R6 — El aislamiento por unidad, visto desde la interfaz.
   *
   * Está aquí y no solo en las pruebas de la API porque es el defecto que más
   * fácilmente se cuela por la pantalla: basta con que un listado pida los
   * datos sin contexto de sesión. BIM24 no tiene ningún maestro sembrado, así
   * que si viera algo, sería de BIM23.
   */
  test('BIM24 no ve los maestros de BIM23', async ({ page }) => {
    await ingresar(page, 'BIM24_PAID');

    await irA(page, '/entidades');
    await expect(page.getByText('Todavía no hay entidades registradas')).toBeVisible();

    await irA(page, '/tripulantes');
    await expect(page.getByText('Todavía no hay tripulantes registrados')).toBeVisible();

    await salir(page);
  });

  /** R4 — Una sola causa visible, sea cual sea la real. */
  test('un ingreso fallido dice solo «Credenciales inválidas»', async ({ page }) => {
    await page.goto('/ingreso');
    await page.locator('#credencial').fill('BIM23_PAID');
    await page.locator('#clave').fill('esta-no-es-la-clave');
    const reto = page.locator('.captcha-texto');
    await expect(reto).toBeVisible();
    await page.locator('#captcha').fill(String(resolver((await reto.textContent()) ?? '')));
    await page.getByRole('button', { name: /^Ingresar/ }).click();

    const aviso = page.getByRole('alert');
    await expect(aviso).toHaveText(/Credenciales inválidas/u);
    /*
     * Nada que distinga la causa: ni «el usuario no existe», ni «bloqueado»,
     * ni «clave expirada». La base guarda las ocho causas para el análisis
     * forense; la pantalla, una.
     *
     * (El patrón evita «red» a secas: «Credenciales» la contiene. Ese falso
     * positivo ya se pagó una vez.)
     */
    await expect(aviso).not.toContainText(
      /no existe|bloquead|inactiv|expirad|captcha|verificaci[oó]n inv[aá]lida|red no autorizada/iu,
    );
  });
});

/** Rellena los campos del panel activo con valores que el esquema acepta. */
async function rellenarPanel(pagina: Page): Promise<void> {
  const campos = pagina.locator('.panel-campos .campo');
  const cuantos = await campos.count();
  for (let i = 0; i < cuantos; i += 1) {
    const campo = campos.nth(i);
    const selector = campo.locator('select');
    if ((await selector.count()) > 0) {
      // Primera opción real: la vacía es «Seleccione…».
      const opciones = selector.locator('option');
      if ((await opciones.count()) > 1) {
        await selector.selectOption({ index: 1 });
      }
      continue;
    }
    const entrada = campo.locator('input, textarea').first();
    /*
     * El modo de entrada dice de qué tipo es el campo, y lo fija el esquema
     * Zod de la pestaña, no su nombre: `cantidad` es entero en «Servicios
     * Prestados» y decimal en «Recursos Utilizados». Escribir `12.5` en los
     * dos lo rechaza uno; escribir `12` en los dos no probaría el decimal.
     */
    const modo = await entrada.getAttribute('inputMode');
    const valor =
      modo === 'decimal'
        ? '12.5' // el separador es el PUNTO, nunca la coma
        : modo === 'numeric'
          ? '120'
          : 'Dato de la prueba de extremo a extremo';
    await entrada.fill(valor);
  }
}

/**
 * Un PDF válido mínimo.
 *
 * Tiene que serlo de verdad: R12 exige que el contenido REAL corresponda a la
 * extensión, y el servidor lo comprueba leyendo los primeros bytes. Un archivo
 * de texto llamado `.pdf` sería rechazado — que es exactamente lo que R12
 * quiere, y por eso la prueba usa uno auténtico.
 */
function pdfMinimo(): Buffer {
  return Buffer.from(
    '%PDF-1.4\n' +
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R>>endobj\n' +
      'trailer<</Root 1 0 R>>\n%%EOF\n',
    'latin1',
  );
}

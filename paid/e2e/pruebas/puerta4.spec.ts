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

    // R9 — la ARC está fijada en «Sí» y no se puede cambiar.
    const arc = page.getByLabel('Armada (ARC)');
    await expect(arc).toHaveValue('SI');
    await expect(arc).toBeDisabled();

    // Láminas 20–21 — tipo de jornada, EJC, FAC y población afecta arrancan
    // SIN responder: un «No» de partida sería la respuesta de quien no
    // contestó (D-30).
    for (const campo of ['#idTipoJornada', '#participoEjc', '#participoFac', '#poblacionAfectaTropa']) {
      await expect(page.locator(campo)).toHaveValue('');
    }

    // R18 — ninguno de los COAMI viene marcado.
    const coami = page.locator('.coami-opcion input[type="checkbox"]');
    const cuantosCoami = await coami.count();
    expect(cuantosCoami).toBeGreaterThan(0);
    for (let i = 0; i < cuantosCoami; i += 1) {
      await expect(coami.nth(i)).not.toBeChecked();
    }

    /*
     * Las coordenadas arrancan VACÍAS. Antes arrancaban en 10° N 75° W, un
     * punto plausible cerca de Cartagena: quien olvidara cambiarlo registraba
     * una ubicación falsa que pasaba todos los controles (P6). Y sin completar
     * las ocho partes, no hay decimales que mostrar.
     */
    await expect(page.locator('#gms-latitudGrados')).toHaveValue('');
    await expect(page.locator('#gms-latitudHemisferio')).toHaveValue('');
    await expect(page.locator('.gms-decimales')).toContainText('al completar');

    // Guardar sin coordenadas no pasa, y el resumen nombra lo que falta.
    await page.getByRole('button', { name: /Guardar y continuar/ }).click();
    const resumen = page.locator('.resumen-errores');
    await expect(resumen).toBeVisible();
    await expect(resumen).toContainText('Latitud: grados');
    await expect(resumen).toContainText('Tipo de jornada');
    await expect(resumen).toContainText('Población afecta a la tropa');
    // Ni mensajes del validador en inglés ni nombres internos de campo: el
    // hemisferio W viene elegido y no falta, aunque la coordenada entera sí.
    await expect(resumen).not.toContainText('Invalid');
    await expect(resumen).not.toContainText('longitudHemisferio');
    await expect(resumen).toBeFocused();

    await page.getByLabel('Tipo de jornada').selectOption({ label: 'Conjunta' });
    await page.getByLabel('Ejército (EJC)').selectOption('NO');
    await page.getByLabel('Fuerza Aérea (FAC)').selectOption('SI');
    await page.getByLabel('Población afecta a la tropa').selectOption('SI');

    // Coordenadas GMS del Pacífico nariñense, y la conversión a decimales a la
    // vista (Fase 4, punto 5).
    await page.locator('#gms-latitudHemisferio').selectOption('N');
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

    // El título es el CÓDIGO DE ACTIVIDAD, no el identificador interno, y el
    // clavegrama queda a la vista mientras se diligencian las pestañas.
    await expect(page.locator('h1')).toHaveText(/^2813304R32026[A-Z0-9]{5}$/u);
    // Y los datos de la lámina 20 vuelven como se eligieron: «No» es «No».
    const datosGenerales = page.locator('.clavegrama-datos');
    await expect(datosGenerales).toContainText('Conjunta');
    await expect(datosGenerales).toContainText('EJC No · ARC Sí · FAC Sí');
    await expect(page.locator('.clavegrama-texto')).toContainText('VEREDA LA PLAYA');

    // ── 3. La rosa dice que faltan las once ───────────────────────────────
    const rosa = page.locator('.franja-datos .rosa-svg');
    await expect(rosa).toHaveAttribute('aria-label', /Registro incompleto/u);

    // ── 4. Las diez pestañas de datos ─────────────────────────────────────
    //
    // Se abre sola en la primera pendiente, y «Añadir y seguir» lleva a la
    // siguiente PENDIENTE. La prueba sigue ese recorrido: es el que va a
    // hacer una persona.
    await expect(page.locator('#titulo-pestana')).toContainText('Tipo Operación');
    for (const pestana of PESTANAS_CON_DATOS) {
      await page.locator(`.pestanas-enlace[data-pestana="${pestana}"]`).click();
      await rellenarPanel(page);
      await page
        .getByRole('button', { name: /^(Añadir|Guardar)( y seguir| registro| resumen)/u })
        .click();
      // La marca de la pestaña en el navegador es la confirmación de que la
      // fila entró: la pinta el servidor, no el formulario.
      await expect(
        page.locator(`.pestanas-enlace[data-pestana="${pestana}"] .pestanas-marca.es-lista`),
      ).toBeVisible();
    }

    // ── 4b. Lo registrado se ve, y se puede quitar ────────────────────────
    //
    // Antes, al añadir una fila desaparecía de la pantalla: no había forma de
    // comprobarla ni de corregirla.
    await page.locator('.pestanas-enlace[data-pestana="SERVICIOS_PRESTADOS"]').click();
    const registradas = page.locator('.registradas tbody tr');
    await expect(registradas).toHaveCount(1);
    await expect(registradas.first()).toContainText('Consulta médica general');
    // Una segunda fila, y quitarla con confirmación.
    await rellenarPanel(page, 1);
    await page.getByRole('button', { name: 'Añadir y agregar otro' }).click();
    await expect(registradas).toHaveCount(2);
    await registradas.nth(1).getByRole('button', { name: /Quitar/u }).click();
    await registradas.nth(1).getByRole('button', { name: 'Quitar', exact: true }).click();
    await expect(registradas).toHaveCount(1);

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
    // La comprobación previa: cabe, y lo dice antes de subir.
    await expect(page.locator('#archivo-ayuda')).toContainText('cabe en la cuota');
    // La fase documental no viene elegida (Q7): sin elegirla no se adjunta.
    await expect(page.getByRole('button', { name: /Adjuntar$/ })).toBeDisabled();
    await page.locator('#fase').selectOption('1');
    await page.getByRole('button', { name: /Adjuntar$/ }).click();
    // Y el soporte queda listado.
    await expect(page.locator('.adjuntos-grupos')).toContainText('soporte-jornada.pdf');

    // ── 7. Solo con las ONCE el registro queda completo (R19) ─────────────
    await expect(page.locator('.franja-datos .rosa-svg')).toHaveAttribute(
      'aria-label',
      /Registro completo/u,
      { timeout: 15_000 },
    );
    // Y lo dice con palabras, con lo que significa.
    await expect(page.locator('.aviso-destacado')).toContainText('entra en los consolidados');

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
  /*
   * Lámina 46: la herramienta AID con estado, fecha de potenciación y
   * responsable inscrito en Personal. Y la regla del manual que más fácil se
   * olvida: si está inactiva, las observaciones dicen por qué.
   */
  test('registra una herramienta inactiva, y sin motivo no la deja guardar', async ({ page }) => {
    await ingresar(page, 'BIM23_PAID');
    await irA(page, '/herramientas');
    await page.getByRole('button', { name: /Registrar herramienta/ }).click();

    const codigo = `HAID-E2E-${String(Date.now()).slice(-6)}`;
    await page.locator('#codigo-herramienta').fill(codigo);
    await page.locator('#nombre-herramienta').fill('Proyector de prueba');
    await page.locator('#gms-latitudHemisferio').selectOption('N');
    await page.locator('#gms-latitudGrados').fill('1');
    await page.locator('#gms-latitudMinutos').fill('47');
    await page.locator('#gms-latitudSegundos').fill('30');
    await page.locator('#gms-longitudGrados').fill('78');
    await page.locator('#gms-longitudMinutos').fill('48');
    await page.locator('#gms-longitudSegundos').fill('45');

    // Los once tipos del manual, sembrados.
    const tipo = page.locator('#tipo-herramienta');
    await expect(tipo.locator('option')).toHaveCount(12); // «Seleccione…» + 11
    await tipo.selectOption({ label: 'Audiovisuales' });
    await page.locator('#estado-herramienta').selectOption({ label: 'Inactiva' });
    await page.locator('#fecha-potenciacion').fill('15/05/2023');
    await page.locator('#responsable-herramienta').selectOption({ index: 1 });

    // Inactiva: las observaciones pasan a ser obligatorias, y sin ellas no guarda.
    await page.getByRole('button', { name: /Guardar herramienta/ }).click();
    // `.error` y no solo el id: la ayuda de un campo obligatorio también dice
    // «por qué», y la prueba pasaría sin que hubiera error.
    await expect(page.locator('p.error#descripcion-herramienta-ayuda')).toContainText('por qué');
    // Por el código, que es único en cada ejecución: el nombre se repite entre
    // ejecuciones sobre la misma base.
    await expect(page.locator('tr', { hasText: codigo })).toHaveCount(0);

    await page
      .locator('#descripcion-herramienta')
      .fill('Lámpara fundida. Repuesto solicitado al almacén; si no llega, pendiente por baja.');
    await page.getByRole('button', { name: /Guardar herramienta/ }).click();

    // Queda en el listado con su estado y su responsable.
    const fila = page.locator('tr', { hasText: codigo });
    await expect(fila).toBeVisible();
    await expect(fila).toContainText('Inactiva');
    await expect(fila).toContainText('15/05/2023');
  });

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
async function rellenarPanel(pagina: Page, opcion = 0): Promise<void> {
  const campos = pagina.locator('.panel-campos .campo');
  const cuantos = await campos.count();
  for (let i = 0; i < cuantos; i += 1) {
    const campo = campos.nth(i);
    const selector = campo.locator('select');
    if ((await selector.count()) > 0) {
      // Primera opción real: la vacía es «Seleccione…».
      const opciones = selector.locator('option');
      if ((await opciones.count()) > 1) {
        // La opción 0 es «Seleccione…»; `opcion` elige entre las reales.
        await selector.selectOption({ index: 1 + opcion });
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

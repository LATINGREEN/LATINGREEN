import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Result } from 'axe-core';
import { ingresar, irA } from './apoyo';

/**
 * 🚪 PUERTA 4, segunda mitad — «revisión de accesibilidad automatizada sin
 * violaciones críticas».
 *
 * ⚠️ Lo que esto comprueba y lo que NO.
 *
 * axe detecta entre un 30 % y un 40 % de los problemas reales de
 * accesibilidad. Pasar esta prueba NO significa que la aplicación sea
 * accesible: significa que no tiene los defectos que una máquina puede
 * encontrar. Lo que ninguna máquina comprueba —que el orden de tabulación
 * tenga sentido, que un rótulo describa de verdad su campo, que un aviso
 * llegue cuando hace falta— se ha decidido a mano en cada componente y está
 * anotado ahí.
 *
 * A una entidad pública colombiana le aplican los lineamientos del MinTIC
 * (Resolución 1519 de 2020), es decir WCAG 2.1 AA. De ahí las etiquetas que se
 * le piden a axe.
 *
 * ── Se revisan los TRES contrastes ──────────────────────────────────────────
 *
 * Y es la parte que importa. Los controles de contraste de la Fase 4 no son
 * decorativos: cada modo redefine los tokens de color, así que cada modo es
 * una paleta distinta que puede fallar por su cuenta. Revisar solo el modo por
 * omisión dejaría sin comprobar exactamente los dos modos que existen para
 * quien necesita accesibilidad.
 */

const ETIQUETAS_WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const CONTRASTES = ['normal', 'claro', 'alto'] as const;

/**
 * Espera a que TODAS las animaciones terminen antes de medir.
 *
 * ⚠️ No es una espera de cortesía: sin ella la revisión es un falso negativo
 * andante. La entrada escalonada (`.escalonado`) arranca en `opacity: 0`, y
 * axe calcula el contraste con el color COMPUESTO: a mitad de la animación ve
 * un gris apagado sobre el fondo y reporta 1,57:1 en textos cuyo token da 7:1.
 * Salieron cuatro violaciones de contraste que no existían.
 *
 * Se usa `document.getAnimations()` y no un `waitForTimeout`: un tiempo fijo
 * es correcto hasta que alguien alarga una duración, y entonces vuelve a
 * medir a medias sin que nada lo delate.
 */
async function esperarAnimaciones(pagina: Page): Promise<void> {
  await pagina.evaluate(async () => {
    await Promise.all(
      document.getAnimations().map(async (animacion) => {
        try {
          await animacion.finished;
        } catch {
          // Una animación cancelada (por ejemplo al desmontarse el nodo)
          // rechaza la promesa. No es un problema: ya no está en pantalla.
        }
      }),
    );
  });
}

async function revisar(pagina: Page): Promise<readonly Result[]> {
  await esperarAnimaciones(pagina);
  const resultado = await new AxeBuilder({ page: pagina })
    .withTags(ETIQUETAS_WCAG)
    /*
     * El lienzo de MapLibre se excluye: es un `<canvas>` de una biblioteca de
     * terceros y sus nodos no son nuestros. Excluirlo no oculta un defecto
     * propio — el botón que lo abre, su rótulo y el texto alternativo de las
     * coordenadas SÍ se revisan, y son lo que una persona con lector de
     * pantalla usa en lugar del mapa.
     */
    .exclude('.maplibregl-map')
    .analyze();
  return resultado.violations;
}

/** Las que la Puerta 4 no admite. Las demás se informan pero no fallan. */
function criticas(violaciones: readonly Result[]): readonly Result[] {
  return violaciones.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

function informe(violaciones: readonly Result[]): string {
  return violaciones
    .map(
      (v) =>
        `  [${v.impact ?? 'sin impacto'}] ${v.id}: ${v.help}\n` +
        v.nodes.map((n) => `      ${n.target.join(' ')}`).join('\n'),
    )
    .join('\n');
}

test.describe('Puerta 4 — accesibilidad (WCAG 2.1 AA)', () => {
  for (const contraste of CONTRASTES) {
    test(`pantalla de ingreso · contraste ${contraste}`, async ({ page }) => {
      await page.goto('/ingreso');
      await page.evaluate(
        (modo) => document.documentElement.setAttribute('data-contraste', modo),
        contraste,
      );
      await expect(page.locator('#credencial')).toBeVisible();
      const violaciones = await revisar(page);
      expect(criticas(violaciones), `Violaciones:\n${informe(violaciones)}`).toEqual([]);
    });
  }

  for (const contraste of CONTRASTES) {
    test(`aplicación con sesión · contraste ${contraste}`, async ({ page }) => {
      await ingresar(page, 'BIM23_PAID');
      await page.evaluate(
        (modo) => document.documentElement.setAttribute('data-contraste', modo),
        contraste,
      );

      for (const ruta of [
        '/',
        '/jornadas',
        '/jornadas/nueva',
        '/tripulantes',
        '/entidades',
        '/herramientas',
        '/normatividad',
      ]) {
        await irA(page, ruta);
        // El encabezado de nivel 1 es la señal de que la página se dibujó: sin
        // esperarlo se revisaría una pantalla a medio pintar y saldrían
        // violaciones que no existen.
        await expect(page.locator('h1')).toBeVisible();
        const violaciones = await revisar(page);
        expect(
          criticas(violaciones),
          `${ruta} (contraste ${contraste}):\n${informe(violaciones)}`,
        ).toEqual([]);
      }
    });
  }

  /**
   * La jornada abierta para diligenciar: clavegrama, pasos, navegador de
   * pestañas, filas registradas y adjuntos. Es la pantalla donde más tiempo
   * pasa una persona, y no la cubría ninguna ruta de la lista anterior porque
   * solo se llega pulsando una jornada del listado.
   */
  for (const contraste of CONTRASTES) {
    test(`jornada abierta con sus pestañas · contraste ${contraste}`, async ({ page }) => {
      await ingresar(page, 'BIM23_PAID');
      await page.evaluate(
        (modo) => document.documentElement.setAttribute('data-contraste', modo),
        contraste,
      );
      await irA(page, '/jornadas');
      await page.locator('.enlace-codigo').first().click();
      await expect(page.locator('.pestanas')).toBeVisible();

      // Una pestaña de datos y la de adjuntos: son paneles distintos.
      for (const pestana of ['SERVICIOS_PRESTADOS', 'ARCHIVOS_ADJUNTOS']) {
        await page.locator(`.pestanas-enlace[data-pestana="${pestana}"]`).click();
        await expect(page.locator('#titulo-pestana')).toBeVisible();
        const violaciones = await revisar(page);
        expect(
          criticas(violaciones),
          `${pestana} (contraste ${contraste}):\n${informe(violaciones)}`,
        ).toEqual([]);
      }
    });
  }

  /**
   * Los formularios desplegados son donde se concentran los defectos de
   * accesibilidad —campos sin rótulo, errores anunciados solo por color— y no
   * se revisan al abrir la página, porque están cerrados. Se abren a mano.
   */
  test('formularios desplegados', async ({ page }) => {
    await ingresar(page, 'BIM23_PAID');

    for (const [ruta, boton] of [
      ['/tripulantes', /Registrar tripulante/],
      ['/entidades', /Registrar entidad/],
      ['/herramientas', /Registrar herramienta/],
    ] as const) {
      await irA(page, ruta);
      await page.getByRole('button', { name: boton }).click();
      await expect(page.locator('.seccion')).toBeVisible();
      const violaciones = await revisar(page);
      expect(criticas(violaciones), `${ruta}:\n${informe(violaciones)}`).toEqual([]);
    }
  });

  /**
   * El tamaño de letra «mayor» sube la raíz al 125 %. Como TODAS las medidas
   * del sistema están en `rem`, la interfaz entera escala. Lo que se comprueba
   * aquí es que no aparezca desplazamiento horizontal: eso es WCAG 1.4.10
   * (Reflow) y es el defecto típico de una hoja de estilos con píxeles
   * sueltos.
   */
  test('el tamaño de letra mayor no produce desplazamiento horizontal', async ({ page }) => {
    await ingresar(page, 'BIM23_PAID');
    await page.evaluate(() => document.documentElement.setAttribute('data-letra', 'mayor'));

    for (const ruta of ['/', '/jornadas', '/jornadas/nueva', '/entidades']) {
      await irA(page, ruta);
      await expect(page.locator('h1')).toBeVisible();
      const desborde = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      // Un píxel de tolerancia por el redondeo del navegador.
      expect(desborde, `${ruta} desborda ${String(desborde)} px`).toBeLessThanOrEqual(1);
    }
  });
});

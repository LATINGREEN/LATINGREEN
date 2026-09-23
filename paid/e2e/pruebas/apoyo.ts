import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Clave de las credenciales sembradas para desarrollo. */
export const CLAVE_DESARROLLO = 'Desarrollo2026*';

/**
 * Ingresa resolviendo el captcha.
 *
 * El captcha es una operación aritmética en TEXTO y no una imagen, así que se
 * puede resolver aquí. Eso no es un descuido del captcha: una imagen sin
 * alternativa textual incumpliría WCAG 2.1 AA, y R3 pide un captcha de un solo
 * uso —que es lo que impide reusar una respuesta—, no un captcha
 * irresoluble por un programa.
 */
export async function ingresar(pagina: Page, credencial: string): Promise<void> {
  await pagina.goto('/ingreso');
  await expect(pagina.getByRole('heading', { name: 'PAID', level: 1 })).toBeVisible();

  await pagina.locator('#credencial').fill(credencial);
  await pagina.locator('#clave').fill(CLAVE_DESARROLLO);

  const reto = pagina.locator('.captcha-texto');
  await expect(reto).toBeVisible();
  await pagina.locator('#captcha').fill(String(resolver((await reto.textContent()) ?? '')));

  await pagina.getByRole('button', { name: /^Ingresar/ }).click();
  // El marco solo se dibuja con sesión: su presencia ES la confirmación.
  await expect(pagina.getByRole('navigation', { name: 'Menú principal' })).toBeVisible();
}

export async function salir(pagina: Page): Promise<void> {
  await pagina.getByRole('button', { name: /Cerrar sesión/ }).click();
  await expect(pagina.locator('#credencial')).toBeVisible();
}

/** «12 + 7» → 19. Lanza si el reto no tiene la forma esperada. */
export function resolver(textoReto: string): number {
  const partes = /(-?\d+)\s*([+-])\s*(-?\d+)/u.exec(textoReto.trim());
  if (partes === null) {
    throw new Error(`El reto no tiene la forma esperada: «${textoReto}»`);
  }
  const a = Number(partes[1]);
  const b = Number(partes[3]);
  return partes[2] === '+' ? a + b : a - b;
}

/**
 * Rutas alcanzables desde el menú, y el enlace que lleva a cada una.
 *
 * ⚠️ Las pruebas navegan PULSANDO, nunca con `page.goto()`, y no es una
 * preferencia de estilo.
 *
 * El testigo de sesión vive en memoria y no en `localStorage` (ver
 * `api/sesion.tsx`): eso es deliberado, porque en un equipo compartido —lo
 * habitual en una unidad— un testigo que sobrevive al cierre de la pestaña es
 * una sesión que nadie cerró. La consecuencia es que **recargar la página
 * cierra la sesión**, y `page.goto()` es una recarga.
 *
 * Una prueba que use `page.goto()` después de ingresar aterriza en la pantalla
 * de ingreso y puede pasar por accidente: el `<h1>` de esa pantalla también
 * dice «PAID». Pasó, y por eso `irA()` comprueba además que el menú sigue en
 * pie antes de dar la navegación por buena.
 */
const ENLACE_DE_RUTA: Readonly<Record<string, { readonly grupo?: string; readonly enlace: string }>> = {
  '/': { enlace: 'Inicio' },
  '/tripulantes': { grupo: 'Tripulantes A.I.', enlace: 'Personal' },
  '/jornadas': { grupo: 'Cooperación Civil Militar', enlace: 'Jornadas de apoyo' },
  '/entidades': { grupo: 'Asuntos Civiles', enlace: 'Entidades A.I.' },
  '/alianzas': { grupo: 'Asuntos Civiles', enlace: 'Alianzas y convenios' },
  '/herramientas': { grupo: 'Sensibilización', enlace: 'Herramientas AID' },
  '/normatividad': { grupo: 'Normatividad A.I.', enlace: 'Normatividad acción integral' },
};

/**
 * Navega dentro de la aplicación, con la sesión intacta.
 *
 * El menú sigue al Manual del Usuario: los módulos se agrupan en desplegables
 * («Cooperación Civil Militar › Jornadas de apoyo»), así que primero se abre
 * el grupo —un botón con `aria-expanded`— y luego se pulsa el enlace.
 */
export async function irA(pagina: Page, ruta: string): Promise<void> {
  // La sesión tiene que estar en pie ANTES de navegar: si no, lo que sigue
  // mide la pantalla de ingreso y no la que se quería revisar.
  const menu = pagina.getByRole('navigation', { name: 'Menú principal' });
  await expect(menu).toBeVisible();

  if (ruta === '/jornadas/nueva') {
    await irA(pagina, '/jornadas');
    await pagina.getByRole('link', { name: /Registrar jornada|Registrar la primera/ }).first().click();
  } else {
    const destino = ENLACE_DE_RUTA[ruta];
    if (destino === undefined) throw new Error(`Sin enlace de menú para «${ruta}»`);
    if (destino.grupo !== undefined) {
      const grupo = menu.getByRole('button', { name: destino.grupo, exact: true });
      if ((await grupo.getAttribute('aria-expanded')) !== 'true') await grupo.click();
      await expect(grupo).toHaveAttribute('aria-expanded', 'true');
    }
    await menu.getByRole('link', { name: destino.enlace, exact: true }).click();
  }

  await expect(pagina).toHaveURL(new RegExp(`${escapar(ruta)}$`, 'u'));
  await expect(menu).toBeVisible();
}

function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

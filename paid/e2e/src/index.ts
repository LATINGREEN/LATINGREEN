/**
 * Pruebas de extremo a extremo.
 *
 * ⛔ Vacio a proposito. La Puerta 4 pide:
 *
 *   «prueba de extremo a extremo que ingresa, crea una jornada completa con
 *    adjunto, la exporta y cierra sesion; mas una revision de accesibilidad
 *    automatizada sin violaciones criticas.»
 *
 * Eso exige la Fase 2 (ingreso) y la Fase 3 (jornadas), que a su vez dependen
 * de la Fase 1, detenida por la ausencia de `anexo_A_ddl_paid.sql`.
 *
 * Herramienta prevista: Playwright con @axe-core/playwright para la revision
 * de accesibilidad (WCAG 2.1 AA, Resolucion MinTIC 1519 de 2020). Se anade
 * como dependencia en la Fase 4, no antes: una dependencia declarada y sin usar
 * es peso muerto en un `node_modules` que hay que transportar a una red cerrada.
 */

export const PENDIENTE_HASTA_FASE = 4 as const;

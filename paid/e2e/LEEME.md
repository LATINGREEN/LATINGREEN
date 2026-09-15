# Puerta 4 — pruebas de extremo a extremo

Dos cosas que la Puerta 4 exige, y una advertencia sobre la segunda.

## Qué hay aquí

- **`pruebas/puerta4.spec.ts`** — el camino completo **por la interfaz**:
  ingresa con captcha, registra una jornada con sus coordenadas GMS, diligencia
  las once pestañas, sube el adjunto, comprueba que el registro pasa a completo
  solo con las once, exporta a CSV y cierra sesión. Más el aislamiento por
  unidad visto desde la pantalla (R6) y el mensaje único del ingreso fallido
  (R4).

  Es distinto de las 80 pruebas de las Puertas 2 y 3: esas hablan con el
  servidor, estas pulsan. Lo que comprueban es la **traducción** entre los dos,
  que es donde se pierden las cosas. Encontró cuatro defectos reales que
  ninguna de las otras podía ver — están en `docs/DECISIONES.md`, D-25 a D-28.

- **`pruebas/accesibilidad.spec.ts`** — la revisión automatizada con axe sobre
  WCAG 2.1 AA, en los **tres modos de contraste** y con el tamaño de letra
  mayor.

  ⚠️ axe encuentra entre el 30 % y el 40 % de los problemas reales de
  accesibilidad. Pasar esto **no** significa que la aplicación sea accesible:
  significa que no tiene los defectos que una máquina puede encontrar. Lo que
  ninguna máquina comprueba —que el orden de tabulación tenga sentido, que un
  rótulo describa de verdad su campo, que un aviso llegue cuando hace falta— se
  decidió a mano en cada componente y está anotado ahí.

## Cómo se ejecutan

Necesitan la aplicación en pie. En una terminal:

    ./scripts/mirar.sh

Y en otra:

    pnpm --filter @paid/e2e test

## Dos cosas que no hay que «arreglar»

**No se usa `page.goto()` después de ingresar.** El testigo de sesión vive en
memoria y no en `localStorage` —deliberado: en un equipo compartido, un testigo
que sobrevive al cierre de la pestaña es una sesión que nadie cerró—, así que
recargar cierra la sesión. Las pruebas navegan pulsando, con `irA()`. Una
versión anterior usaba `page.goto()` y **pasaba en falso**: aterrizaba en la
pantalla de ingreso, cuyo `<h1>` también dice «PAID».

**No se descarga Chromium.** A.2.1 prohíbe internet en tiempo de ejecución.
`playwright.config.ts` apunta con `executablePath` al Chromium ya instalado en
la imagen. `PLAYWRIGHT_CHROMIUM` sobrescribe la ruta si en otro equipo es otra.

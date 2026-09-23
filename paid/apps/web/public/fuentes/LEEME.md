# Fuentes tipográficas

Autoalojadas en woff2 y declaradas con `@font-face` local en
`src/estilos/tokens.css`. **No** se puede usar `fonts.googleapis.com` ni ningún
CDN (A.2.1): una `@font-face` remota no falla de forma visible, cae al tipo del
sistema y el defecto pasa inadvertido.

| Familia | Uso | Por qué |
|---|---|---|
| Oswald 500 | El título «PAID / Plataforma de Acción Integral y Desarrollo» de la cabecera | Es la condensada que muestra la cabecera en el Manual del Usuario PAID. |
| Montserrat 600 y 700 | Títulos, menú, botones | Es la tipografía de títulos de la plantilla GOV.CO que la PAID usa según su manual. |
| Atkinson Hyperlegible 400 y 700 | Texto corrido y campos | Diseñada por la Braille Institute para baja visión; aplica la Res. MinTIC 1519 de 2020 (WCAG 2.1 AA). |
| IBM Plex Mono 400 y 500 | Códigos, cifras, coordenadas | Cifras tabulares: una columna de números que baila no se puede comparar. |

Todas con licencia SIL Open Font License 1.1. Se obtuvieron de los paquetes
`@fontsource/*` del registro npm en tiempo de construcción.

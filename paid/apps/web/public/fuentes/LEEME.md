# Fuentes tipográficas

Van aquí, servidas desde el propio despliegue, y se declaran con `@font-face`
local en `src/estilos.css`.

**No** se puede usar `fonts.googleapis.com` ni ningún CDN: la aplicación corre
en la Intranet ARC y no hay internet en tiempo de ejecución (PROMPT.md A.2.1).
Una `@font-face` remota no falla de forma visible — simplemente cae al tipo de
letra del sistema, y el defecto pasa inadvertido hasta que alguien compara la
pantalla con el manual.

Mientras no se decida la familia tipográfica institucional, `estilos.css` usa
la pila `system-ui`, que no requiere descarga alguna.

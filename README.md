# ♻️ Eco-Arcade Latin Green E.S.P.

Videojuego arcade educativo **para un jugador** en el que debes lanzar los
residuos que llegan por la banda transportadora a la caneca correcta,
siguiendo el código de colores de separación en la fuente aplicado en Colombia:

| Caneca | Color | Residuos |
|--------|-------|----------|
| ⚪ **Blanca** | Aprovechables | Plástico, vidrio, cartón, papel, metales, tetrapak, CD |
| ⚫ **Negra** | No aprovechables | Papel higiénico, servilletas usadas, icopor sucio, colillas |
| 🟢 **Verde** | Orgánicos | Restos de comida, cáscaras, residuos de jardín, borra de café |

Cada caneca está claramente identificada en pantalla con su **color en la tapa**
(BLANCA / NEGRA / VERDE), un **ícono** (♻️ / 🚫 / 🌱) y su **rótulo de
categoría** (APROVECHABLES / NO APROVECHABLES / ORGÁNICOS).

## 📁 Archivos

| Archivo | Descripción |
|---------|-------------|
| `index.html` | El juego completo |
| `assets/logo.svg` | Logo Latin Green E.S.P. (recreación vectorial fiel al original; puede reemplazarse por el archivo oficial conservando el nombre) |
| `assets/latin-green.m4a` | Pista musical de Latin Green (música ambiental de la pantalla de inicio) |
| `build-single-file.mjs` | Genera `eco-arcade-latin-green.html`: el juego en un solo archivo con logo y música incrustados |

> 💡 Para compartir el juego, copia la carpeta completa (con `assets/`) o
> genera la versión de un solo archivo con `node build-single-file.mjs`.

## 🎮 Cómo jugar

1. Abre `index.html` en cualquier navegador moderno (Chrome, Firefox, Edge,
   Safari), en computador, tableta o celular. No requiere instalación ni
   conexión a internet.
2. **Escribe tu nombre** (opcional, hasta 12 caracteres): aparece en el
   marcador, en los resultados de cada ronda y en la premiación.
3. Presiona **¡A JUGAR!**.
4. El residuo activo (resaltado con un aro) muestra su nombre; decide rápido
   a qué caneca lanzarlo. Hay **35 tipos de residuos**: 13 aprovechables,
   10 no aprovechables y 12 orgánicos.

### Controles

| Dispositivo | Cómo lanzar |
|-------------|-------------|
| 📱 **Celular / tableta** | **Toca la caneca** donde quieras lanzar (la caneca tocada se resalta) |
| ⌨️ **Teclado** | `A`/`S`/`D` o `J`/`K`/`L` → caneca blanca / negra / verde |
| 🖱️ **Mouse** | Clic sobre la caneca |
| 🎮 **Control** (USB o Bluetooth) | ⬜/X o cruceta ⬅ → blanca · ✕/A o ⬇ → negra · ⭕/B o ➡ → verde · START avanza pantallas |

- Tecla `M` o botón 🔊: silenciar / activar sonido.
- En celular, el juego se muestra en **vertical** de forma nativa y pasa a
  pantalla completa al iniciar.

### Rondas, puntuación y récord

- 🕹️ Partida de **3 rondas de 45 segundos** (~2½ minutos). Cada ronda es
  más rápida, y dentro de cada ronda los residuos llegan con más frecuencia.
- ✅ Acierto: **+100 puntos** (bonificación por combo desde 3 aciertos seguidos).
- ❌ Error: **−50 puntos**, se reinicia el combo y el juego muestra cuál era
  la caneca correcta.
- 🏆 **Récord personal** guardado en el dispositivo: el juego lo muestra en
  el inicio y celebra cuando lo superas.
- 🎭 La **escena final** evalúa tu desempeño según la precisión: con 60 % o
  más celebras con confeti y fanfarria (🏆 "¡Excelente!"), entre 40 % y 59 %
  recibes ánimo (💪 "¡Buen intento!"), y por debajo aparece la animación de
  llanto con trombón triste (😢 "¡Sigue practicando!").

## 🔊 Sonido y música

- En la **pantalla de inicio** suena la pista oficial de Latin Green como
  música ambiental (arranca con tu primer toque o clic, como exigen los
  navegadores).
- Durante la **partida** suena un tema chiptune estilo arcade, y en la
  **premiación** un tema festivo especial (ambos generados con la Web Audio
  API, sin archivos externos).
- Efectos de lanzamiento, acierto, error, combos y cuenta regresiva.

## 📲 Instalar como app en el celular (Android y iOS)

El juego es una **aplicación web instalable (PWA)**: se instala desde el
navegador, queda con su propio ícono en la pantalla de inicio, abre a pantalla
completa como cualquier app y **funciona sin internet** después de la primera
carga. No pasa por tiendas ni necesita permisos especiales.

**Dirección del juego (GitHub Pages):** https://latingreen.github.io/LATINGREEN/

| Dispositivo | Pasos |
|-------------|-------|
| 🤖 **Android** (Chrome, Edge, Samsung Internet) | Abre la dirección y toca el botón **📲 Instalar en este dispositivo** que aparece bajo "¡A JUGAR!" (o el menú ⋮ → *Instalar aplicación*). |
| 🍎 **iPhone / iPad** (Safari) | Abre la dirección, toca **Compartir** (cuadrado con flecha ⬆) y luego **"Añadir a pantalla de inicio"**. El juego muestra estas instrucciones en pantalla. |
| 💻 **Computador** (Chrome, Edge) | Ícono de instalar en la barra de direcciones. |

Archivos que hacen posible la instalación: `manifest.webmanifest` (nombre,
ícono y colores de la app), `sw.js` (service worker: copia el juego en el
dispositivo para jugar sin conexión) e `icons/` (íconos de la app). Cuando
publiques una nueva versión del juego, sube el número de `CACHE` en `sw.js`
para que los dispositivos ya instalados la descarguen.

**Publicación automática:** cada cambio subido al repositorio se publica en
GitHub Pages mediante `.github/workflows/pages.yml`.

**¿Y una tienda de aplicaciones?** Si más adelante quieres el juego en Google
Play, la herramienta gratuita [PWABuilder](https://www.pwabuilder.com) genera
un paquete Android (APK/AAB) a partir de la dirección publicada. Para la App
Store de Apple se requiere una cuenta de desarrollador de Apple (de pago) y
publicar mediante Xcode; la instalación desde Safari descrita arriba no la
necesita.

### Otras formas de compartirlo

- **Enlace directo** sin instalar: la misma dirección de arriba, o el artifact
  de Claude.
- **Un solo archivo**: `node build-single-file.mjs` genera
  `eco-arcade-latin-green.html` con todo incrustado; compártelo por WhatsApp o
  correo. En Android se abre con Chrome; en iPhone los archivos locales no
  ejecutan juegos, así que usa la instalación desde Safari.

## 🌱 Objetivo educativo

El juego enseña de forma divertida la separación correcta de residuos en la
fuente, reforzando qué materiales son aprovechables, cuáles no y cuáles son
orgánicos compostables.

---
**Latin Green E.S.P.** · Separar es cuidar el planeta 🌎

# ♻️ Eco-Arcade Latin Green E.S.P.

Videojuego arcade **para 2 jugadores** donde cada jugador debe lanzar los residuos
que llegan por la banda transportadora a la caneca correcta, siguiendo el código
de colores de separación en la fuente:

| Caneca | Color | Residuos |
|--------|-------|----------|
| ⚪ **Blanca** | Aprovechables | Plástico, vidrio, cartón, papel, metales |
| ⚫ **Negra** | No aprovechables | Papel higiénico, servilletas usadas, icopor sucio, colillas |
| 🟢 **Verde** | Orgánicos | Restos de comida, cáscaras, residuos de jardín, borra de café |

Cada caneca está claramente identificada en pantalla con su **color en la tapa**
(BLANCA / NEGRA / VERDE), un **ícono** (♻️ / 🚫 / 🌱) y su **rótulo de
categoría** (APROVECHABLES / NO APROVECHABLES / ORGÁNICOS).

## 📁 Archivos

| Archivo | Descripción |
|---------|-------------|
| `index.html` | El juego completo |
| `assets/logo.svg` | Logo Latin Green E.S.P. (versión vectorial recreada; puedes reemplazarla por tu archivo oficial conservando el nombre) |
| `assets/latin-green.m4a` | Pista musical de Latin Green (música ambiental de la pantalla de inicio) |

> 💡 Para compartir el juego, copia la carpeta completa (con `assets/`),
> no solo el `index.html`.

## 🎮 Cómo jugar

1. Abre `index.html` en cualquier navegador moderno (Chrome, Firefox, Edge).
   No requiere instalación ni conexión a internet.
2. **Elige el modo de juego** en el menú:
   - 🕹️ **1 Jugador (individual)**: toda la pantalla para ti; al final el
     juego evalúa tu desempeño según tu precisión (🏆 excelente / 💪 buen
     intento / 😢 sigue practicando). Puedes usar `A`/`S`/`D` o `J`/`K`/`L`.
   - ⚔️ **2 Jugadores (VS)**: duelo en pantalla dividida; gana quien
     conquiste más rondas.
3. **Escribe el nombre de cada jugador** en su tarjeta (opcional; hasta 12
   caracteres). Los nombres aparecen en el marcador, en los resultados de cada
   ronda y en la pantalla final.
4. Presiona **¡A JUGAR!**.
4. Cada jugador ve su zona con su banda de residuos y sus 3 canecas.
   El residuo activo (resaltado con un aro de color) muestra su nombre;
   decide rápido a qué caneca lanzarlo. Hay **34 tipos de residuos**:
   12 aprovechables (plástico, vidrio, metales, papel, cartón y tetrapak),
   10 no aprovechables y 12 orgánicos.

### Controles

| Acción | Jugador 1 | Jugador 2 |
|--------|-----------|-----------|
| Lanzar a caneca **BLANCA** | `A` | `J` |
| Lanzar a caneca **NEGRA** | `S` | `K` |
| Lanzar a caneca **VERDE** | `D` | `L` |

🔊 **Sonido y música:**
- En la **pantalla de personalización** suena la pista oficial de Latin Green
  como música ambiental (arranca con tu primer clic o tecla, como lo exigen
  los navegadores).
- Durante la **partida** suena un tema chiptune estilo arcade, y en la
  **escena de premiación** un tema festivo especial (ambos generados con la
  Web Audio API).
- Efectos de lanzamiento, acierto, error, combos y cuenta regresiva.
- Silencia todo con el botón 🔊 de la esquina superior derecha o la tecla `M`.

🎨 **Zonas diferenciadas:** el lado del Jugador 1 es **azul** y el del
Jugador 2 es **rosa** (fondo, franja superior y teclas), para identificar
cada lado de un vistazo durante la partida.

### Rondas y puntuación

- 🕹️ La partida se juega a **3 rondas de 45 segundos** (partidas cortas, ~2½ minutos).
- ⚡ Cada ronda es **más rápida** que la anterior, y dentro de cada ronda los
  residuos también llegan cada vez con mayor frecuencia.
- ✅ Acierto: **+100 puntos** (y bonificación por combo a partir de 3 aciertos seguidos).
- ❌ Error: **−50 puntos**, se reinicia el combo y el juego te muestra cuál era la caneca correcta.
- ⭐ Quien haga más puntos en una ronda **gana la ronda** (una estrella).
- 🏆 **Gana la partida quien conquiste más rondas**; si empatan en rondas,
  decide el puntaje total. La pantalla final muestra el ganador, la precisión
  de cada jugador, el detalle por ronda y un dato ecológico.
- 🥳 En la escena final, el ganador **celebra con confeti y saltos de alegría**
  mientras el perdedor **llora desconsolado** (con su respectivo "trombón
  triste" 🎺). Si hay empate, ambos celebran por el planeta.

## 🌱 Objetivo educativo

El juego enseña de forma divertida la separación correcta de residuos en la
fuente, reforzando qué materiales son aprovechables, cuáles no y cuáles son
orgánicos compostables.

---
**LatinGreen** · Separar es cuidar el planeta 🌎

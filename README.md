# ♻️ Eco-Arcade LatinGreen

Videojuego arcade **para 2 jugadores** donde cada jugador debe lanzar los residuos
que llegan por la banda transportadora a la caneca correcta, siguiendo el código
de colores de separación en la fuente:

| Caneca | Color | Residuos |
|--------|-------|----------|
| ⚪ **Blanca** | Aprovechables | Plástico, vidrio, cartón, papel, metales |
| ⚫ **Negra** | No aprovechables | Papel higiénico, servilletas usadas, icopor sucio, colillas |
| 🟢 **Verde** | Orgánicos | Restos de comida, cáscaras, residuos de jardín, borra de café |

## 🎮 Cómo jugar

1. Abre `index.html` en cualquier navegador moderno (Chrome, Firefox, Edge).
   No requiere instalación ni conexión a internet.
2. Presiona **¡A JUGAR!**.
3. Cada jugador ve su zona con su banda de residuos y sus 3 canecas.
   El residuo activo (resaltado con un aro de color) muestra su nombre;
   decide rápido a qué caneca lanzarlo.

### Controles

| Acción | Jugador 1 | Jugador 2 |
|--------|-----------|-----------|
| Lanzar a caneca **BLANCA** | `A` | `J` |
| Lanzar a caneca **NEGRA** | `S` | `K` |
| Lanzar a caneca **VERDE** | `D` | `L` |

🔊 El juego incluye **efectos de sonido y música de fondo estilo arcade**
(generados con la Web Audio API, sin archivos externos). Puedes silenciarlos
con el botón 🔊 de la esquina superior derecha o con la tecla `M`.

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

## 🌱 Objetivo educativo

El juego enseña de forma divertida la separación correcta de residuos en la
fuente, reforzando qué materiales son aprovechables, cuáles no y cuáles son
orgánicos compostables.

---
**LatinGreen** · Separar es cuidar el planeta 🌎

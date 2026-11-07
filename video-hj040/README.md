# Video cinematográfico HJ-040

Video vertical (1080×1920, 30 fps, 44 s) para Reels / TikTok / Shorts, armado con
[Remotion](https://www.remotion.dev) a partir de las fotos del día de vuelo en el
HJ-040 (MX80) sobre la Sabana de Bogotá.

**Video listo:** [`video-final/vuelo-hj040-rock.mp4`](video-final/vuelo-hj040-rock.mp4)

## Estructura del montaje (todo cortado al ritmo, 120 BPM)

| Tiempo   | Escena                                                        |
| -------- | ------------------------------------------------------------- |
| 0–8 s    | Intro oscura: riff de guitarra sola, aparece "HJ-040"          |
| 8 s      | Entra la batería → destello, empiezan las escenas             |
| 8–12 s   | 01 · Pre-vuelo (panel de instrumentos)                        |
| 12–16 s  | 02 · Cabina, "Listos para despegar"                           |
| 16–20 s  | 03 · En el aire: captura del radar, zoom al avión (Chía · Cajicá · Zipaquirá) |
| 20–24 s  | 04 · La tripulación                                           |
| 24–28 s  | 05 · Cielo despejado                                          |
| 28–32 s  | 06 · Copiloto oficial (el perrito con chaqueta de aviador)    |
| 32–40 s  | Coro: montaje rápido, corte cada 2 tiempos + MOTOR / VIENTO / ALTURA / LIBERTAD |
| 40–44 s  | Golpe final, "HJ-040 · Cielos de Colombia", fundido a negro   |

Efectos: Ken Burns en cada foto, sacudida de cámara con el bombo y la caja,
destellos en los cortes, grano de película, viñeta, virado teal & orange,
fugas de luz y barras de cine en la intro y el final.

## Música

La pista incluida (`public/musica/rock-original-hj040.wav`) es **original**:
un instrumental de hard rock al estilo de los 70-80 sintetizado desde cero con
`scripts/generar_musica.py` (guitarras con power chords y palm mute, bajo,
batería). No contiene grabaciones ni melodías de AC/DC.

Las canciones de AC/DC tienen derechos de autor, así que no vienen incluidas.
Para usar una:

- **Instagram / TikTok / CapCut (lo más fácil):** sube el video, agrega la
  canción desde la biblioteca de música de la app (ahí ya está licenciada) y
  baja a 0 el volumen del audio original. También se puede usar la versión
  sin audio (abajo).
- **Re-renderizar con tu archivo:** si tienes la canción con licencia, ponla en
  `public/musica/` y cambia `musica` en `defaultVueloProps`
  (`src/VueloHJ040.tsx`). El montaje está a 120 BPM; temas a ese tempo o al
  doble/mitad encajan mejor con los cortes.

## Comandos

```bash
npm i
npm run dev                                # vista previa en Remotion Studio
python3 scripts/generar_musica.py          # regenera la pista (numpy + scipy)
npx remotion render VueloHJ040 out/vuelo-hj040.mp4 --codec=h264 --crf=18

# Versión liviana para redes (~50 MB) y versión sin audio
ffmpeg -i out/vuelo-hj040.mp4 -c:v libx264 -preset slow -crf 21 -maxrate 9M -bufsize 18M \
  -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 256k \
  -af "loudnorm=I=-14:TP=-1.0:LRA=9" video-final/vuelo-hj040-rock.mp4
ffmpeg -i video-final/vuelo-hj040-rock.mp4 -c:v copy -an video-final/vuelo-hj040-sin-musica.mp4
```

## Archivos

- `src/VueloHJ040.tsx`: composición principal (escenas, textos, efectos globales)
- `src/scenes/`: intro, radar, montaje del coro y final
- `src/components/`: foto con Ken Burns, títulos y capas de efectos
- `src/timing.ts`: tempo y secciones (1 compás = 60 cuadros)
- `public/photos/`: fotos del vuelo

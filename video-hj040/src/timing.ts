// Todo el montaje está amarrado al tempo de la música: 120 BPM a 30 fps.
// 1 tiempo = 15 cuadros, 1 compás = 60 cuadros (2 s).
export const FPS = 30;
export const BEAT = 15;
export const BAR = 60;
export const EIGHTH = BEAT / 2;

export const WIDTH = 1080;
export const HEIGHT = 1920;

// Secciones de la canción (en cuadros)
export const INTRO_END = 4 * BAR; // 240: entra la batería
export const CORO_START = 16 * BAR; // 960
export const FINAL_START = 20 * BAR; // 1200: golpe final
export const DURATION = 22 * BAR; // 1320 = 44 s

// Golpes de guitarra abiertos dentro del riff de 2 compases (en corcheas)
export const RIFF_ACCENTS = [0, 4, 5, 8, 12, 13, 14, 15];

// Cortes "fuertes" con destello blanco
export const BIG_HITS = [INTRO_END, CORO_START, FINAL_START];

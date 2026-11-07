import "./fonts";
import { Audio } from "@remotion/media";
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  random,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {
  ColorGrade,
  FilmGrain,
  Flash,
  Letterbox,
  LightLeak,
  Vignette,
} from "./components/Overlays";
import { Photo } from "./components/Photo";
import { SceneTitle } from "./components/Titles";
import { Final } from "./scenes/Final";
import { Intro } from "./scenes/Intro";
import { Montaje } from "./scenes/Montaje";
import { Radar } from "./scenes/Radar";
import {
  BAR,
  BEAT,
  CORO_START,
  DURATION,
  FINAL_START,
  INTRO_END,
} from "./timing";

export type VueloProps = {
  /** Archivo de audio dentro de public/. Cámbialo por tu canción con licencia. */
  musica: string;
  volumen: number;
};

export const defaultVueloProps: VueloProps = {
  musica: "musica/rock-original-hj040.wav",
  volumen: 1,
};

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

// Sacudida de cámara al ritmo de bombo y caja
const useBeatShake = () => {
  const frame = useCurrentFrame();
  const inBand = frame >= INTRO_END && frame < FINAL_START;
  const beatIndex = Math.floor(frame / BEAT);
  const e = frame - beatIndex * BEAT;
  if (inBand) {
    const kick = beatIndex % 2 === 0; // tiempos 1 y 3
    const chorus = frame >= CORO_START ? 1.4 : 1;
    const amp = (kick ? 9 : 5) * chorus * Math.exp(-e / 2.2);
    const a = random(`shake${beatIndex}`) * Math.PI * 2;
    return {
      x: Math.cos(a) * amp,
      y: Math.sin(a) * amp,
      s: 1 + (kick ? 0.018 : 0.008) * chorus * Math.exp(-e / 3),
    };
  }
  if (frame >= FINAL_START) {
    const f = frame - FINAL_START;
    const amp = 16 * Math.exp(-f / 5);
    const a = random(`fin${f}`) * Math.PI * 2;
    return { x: Math.cos(a) * amp, y: Math.sin(a) * amp, s: 1 + 0.03 * Math.exp(-f / 6) };
  }
  return { x: 0, y: 0, s: 1 };
};

// Escenas de fotos (cada una dura 2 compases = 4 s)
const ESCENAS: {
  src: string;
  focus: [number, number];
  zoom: [number, number];
  pan?: [[number, number], [number, number]];
  label: string;
  title: string;
  sub: string;
}[] = [
  {
    src: "07-panel-cabina.jpg",
    focus: [52, 55],
    zoom: [1.05, 1.22],
    label: "01 · PRE-VUELO",
    title: "CHECK DE CABINA",
    sub: "Instrumentos listos",
  },
  {
    src: "04-cabina-pilotos.jpg",
    focus: [45, 48],
    zoom: [1.12, 1.02],
    label: "02 · CABINA",
    title: "LISTOS PARA DESPEGAR",
    sub: "Cascos puestos, cinturones ajustados",
  },
  // 03 · Radar (escena propia)
  {
    src: "01-avion-perro-angulo.jpg",
    focus: [50, 45],
    zoom: [1.04, 1.16],
    pan: [
      [20, 0],
      [-20, 0],
    ],
    label: "04 · TIERRA FIRME",
    title: "LA TRIPULACIÓN",
    sub: "Humana y canina",
  },
  {
    src: "02-pose-avion.jpg",
    focus: [42, 40],
    zoom: [1.14, 1.03],
    label: "05 · BAJO EL ALA",
    title: "CIELO DESPEJADO",
    sub: "Sol, nubes y un ala sobre la cabeza",
  },
  {
    src: "05-copiloto-perro.jpg",
    focus: [50, 38],
    zoom: [1.03, 1.18],
    label: "06 · COPILOTO",
    title: "COPILOTO OFICIAL",
    sub: "Chaqueta de aviador y bandera de Colombia",
  },
];

const ESCENA_LEN = 2 * BAR;

export const VueloHJ040: React.FC<VueloProps> = ({ musica, volumen }) => {
  const frame = useCurrentFrame();
  const shake = useBeatShake();

  // Inicio de cada escena de fotos (la 3ª posición es el radar)
  const starts = [0, 1, 3, 4, 5].map((i) => INTRO_END + i * ESCENA_LEN);
  const radarStart = INTRO_END + 2 * ESCENA_LEN;
  const smallCuts = [1, 2, 3, 4, 5].map((i) => INTRO_END + i * ESCENA_LEN);
  const montageCuts = Array.from({ length: 7 }, (_, i) => CORO_START + (i + 1) * 2 * BEAT);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Audio src={staticFile(musica)} volume={volumen} />

      <AbsoluteFill
        style={{
          scale: String(1.04 * shake.s),
          translate: `${shake.x}px ${shake.y}px`,
        }}
      >
        <Sequence name="Intro" durationInFrames={INTRO_END} layout="absolute-fill">
          <Intro />
        </Sequence>

        {ESCENAS.map((e, i) => (
          <Sequence
            key={e.src}
            name={e.title}
            from={starts[i]}
            durationInFrames={ESCENA_LEN}
            layout="absolute-fill"
          >
            <Photo src={e.src} focus={e.focus} zoom={e.zoom} pan={e.pan} punch={0.06} />
            <SceneTitle label={e.label} title={e.title} sub={e.sub} />
          </Sequence>
        ))}

        <Sequence
          name="Radar"
          from={radarStart}
          durationInFrames={ESCENA_LEN}
          layout="absolute-fill"
        >
          <Radar />
        </Sequence>

        <Sequence
          name="Coro (montaje)"
          from={CORO_START}
          durationInFrames={FINAL_START - CORO_START}
          layout="absolute-fill"
        >
          <Montaje />
        </Sequence>

        <Sequence
          name="Final"
          from={FINAL_START}
          durationInFrames={DURATION - FINAL_START}
          layout="absolute-fill"
        >
          <Final />
        </Sequence>
      </AbsoluteFill>

      <ColorGrade />
      <LightLeak
        intensity={
          frame < INTRO_END
            ? 0.18
            : frame < CORO_START
              ? 0.28
              : frame < FINAL_START
                ? 0.42
                : 0.32
        }
      />
      <Vignette />
      <FilmGrain />
      <Letterbox />
      <Flash
        hits={[
          { at: INTRO_END, strength: 0.95, length: 12 },
          { at: CORO_START, strength: 0.95, length: 12 },
          { at: FINAL_START, strength: 1, length: 16 },
          ...smallCuts.map((at) => ({ at, strength: 0.45, length: 7 })),
          ...montageCuts.map((at) => ({ at, strength: 0.3, length: 5 })),
        ]}
      />
      {/* Fundido a negro */}
      <AbsoluteFill
        style={{
          backgroundColor: "black",
          opacity: interpolate(frame, [DURATION - 30, DURATION - 4], [0, 1], clamp),
        }}
      />
    </AbsoluteFill>
  );
};

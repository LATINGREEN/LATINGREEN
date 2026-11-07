import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Photo } from "../components/Photo";
import { SlamWord } from "../components/Titles";
import { BAR, BEAT } from "../timing";

// Coro: un corte cada 2 tiempos y una palabra por compás
const SHOTS: {
  src: string;
  focus: [number, number];
  zoom: [number, number];
}[] = [
  { src: "06-hj040-rodaje.jpg", focus: [70, 52], zoom: [1.06, 1.14] },
  { src: "04-cabina-pilotos.jpg", focus: [45, 50], zoom: [1.1, 1.2] },
  { src: "01-avion-perro-angulo.jpg", focus: [50, 45], zoom: [1.06, 1.14] },
  { src: "07-panel-cabina.jpg", focus: [55, 55], zoom: [1.12, 1.24] },
  { src: "02-pose-avion.jpg", focus: [40, 40], zoom: [1.06, 1.16] },
  { src: "05-copiloto-perro.jpg", focus: [50, 40], zoom: [1.05, 1.15] },
  { src: "03-radar-vuelo.jpg", focus: [73, 47], zoom: [1.3, 1.5] },
  { src: "06-hj040-rodaje.jpg", focus: [33, 47], zoom: [1.55, 1.75] },
];

const WORDS = ["MOTOR", "VIENTO", "ALTURA", "LIBERTAD"];

export const Montaje: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {SHOTS.map((s, i) => (
        <Sequence
          key={i}
          name={`Toma ${i + 1}`}
          from={i * 2 * BEAT}
          durationInFrames={2 * BEAT}
          layout="absolute-fill"
        >
          <Photo src={s.src} focus={s.focus} zoom={s.zoom} punch={0.12} />
        </Sequence>
      ))}
      {WORDS.map((w, i) => (
        <Sequence
          key={w}
          name={`Palabra ${w}`}
          from={i * BAR}
          durationInFrames={BAR}
          layout="absolute-fill"
        >
          <SlamWord word={w} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

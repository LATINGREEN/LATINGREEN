import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  random,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { FINAL_START, INTRO_END } from "../timing";

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

// Grano de película: mosaico de una textura de 512 px que salta de posición
// en cada cuadro. Se usa <Img> (no background-image) para que Remotion espere
// a que cargue antes de capturar cada cuadro.
const TILE = 512;
const COLS = 4; // 4 x 512 = 2048 > 1080 + 512
const ROWS = 6; // 6 x 512 = 3072 > 1920 + 512

export const FilmGrain: React.FC<{ opacity?: number }> = ({ opacity = 0.13 }) => {
  const frame = useCurrentFrame();
  const x = Math.floor(random(`gx${frame}`) * TILE);
  const y = Math.floor(random(`gy${frame}`) * TILE);
  const src = staticFile("fx/grano.png");
  return (
    <AbsoluteFill style={{ mixBlendMode: "overlay", opacity, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: -x,
          top: -y,
          width: COLS * TILE,
          height: ROWS * TILE,
          display: "flex",
          flexWrap: "wrap",
        }}
      >
        {Array.from({ length: COLS * ROWS }, (_, i) => (
          <Img
            key={i}
            src={src}
            style={{ width: TILE, height: TILE, display: "block" }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse 75% 60% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.62) 100%)",
    }}
  />
);

// Virado teal & orange típico de cine
export const ColorGrade: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "linear-gradient(180deg, rgba(0,90,120,0.55) 0%, rgba(0,0,0,0) 45%, rgba(255,140,40,0.45) 100%)",
      mixBlendMode: "soft-light",
    }}
  />
);

// Fugas de luz cálidas que derivan lentamente
export const LightLeak: React.FC<{ intensity?: number }> = ({
  intensity = 0.35,
}) => {
  const frame = useCurrentFrame();
  const ax = 20 + 60 * (0.5 + 0.5 * Math.sin(frame / 47));
  const ay = 15 + 25 * (0.5 + 0.5 * Math.cos(frame / 61));
  const bx = 80 - 50 * (0.5 + 0.5 * Math.sin(frame / 73 + 1.3));
  const by = 80 - 20 * (0.5 + 0.5 * Math.cos(frame / 53 + 0.4));
  return (
    <AbsoluteFill
      style={{
        mixBlendMode: "screen",
        opacity: intensity,
        background: `radial-gradient(circle at ${ax}% ${ay}%, rgba(255,150,40,0.85) 0%, rgba(255,90,20,0.35) 22%, rgba(0,0,0,0) 48%), radial-gradient(circle at ${bx}% ${by}%, rgba(255,70,90,0.35) 0%, rgba(0,0,0,0) 40%)`,
      }}
    />
  );
};

// Destello blanco en los cortes
export const Flash: React.FC<{
  hits: { at: number; strength: number; length?: number }[];
}> = ({ hits }) => {
  const frame = useCurrentFrame();
  let opacity = 0;
  for (const h of hits) {
    const len = h.length ?? 9;
    if (frame >= h.at && frame < h.at + len) {
      opacity = Math.max(
        opacity,
        interpolate(frame, [h.at, h.at + len], [h.strength, 0], {
          ...clamp,
          easing: Easing.bezier(0.2, 0.6, 0.4, 1),
        }),
      );
    }
  }
  return <AbsoluteFill style={{ backgroundColor: "white", opacity }} />;
};

// Barras de cine: presentes en la intro y el final, se retiran cuando entra la banda
export const Letterbox: React.FC = () => {
  const frame = useCurrentFrame();
  const h = interpolate(
    frame,
    [0, INTRO_END - 10, INTRO_END + 4, FINAL_START, FINAL_START + 24],
    [170, 170, 0, 0, 170],
    { ...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1) },
  );
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: h,
          backgroundColor: "black",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: h,
          backgroundColor: "black",
        }}
      />
    </AbsoluteFill>
  );
};

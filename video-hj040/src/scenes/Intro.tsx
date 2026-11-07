import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Photo } from "../components/Photo";
import { AMBER, BODY_FONT, MONO_FONT, TITLE_FONT } from "../fonts";
import { BAR, EIGHTH, INTRO_END, RIFF_ACCENTS } from "../timing";

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

// Pulso de luz en cada golpe abierto de la guitarra (riff x2 en la intro)
const riffPulse = (frame: number) => {
  let p = 0;
  for (const rep of [0, 1]) {
    for (const step of RIFF_ACCENTS) {
      const at = Math.floor((rep * 16 + step) * EIGHTH);
      if (frame >= at) p = Math.max(p, Math.exp(-(frame - at) / 5));
    }
  }
  return p;
};

const flicker = (local: number) => {
  if (local < 0) return 0;
  const pattern = [1, 0, 0.8, 0, 0, 1, 0.3, 1, 0.6, 1];
  return local < pattern.length ? pattern[local] : 1;
};

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = riffPulse(frame);
  const base = interpolate(frame, [0, BAR, 2 * BAR, INTRO_END], [0.22, 0.38, 0.5, 0.62], clamp);
  const rush = interpolate(frame, [INTRO_END - 18, INTRO_END], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.55, 0, 1, 0.45),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <AbsoluteFill
        style={{
          scale: String(1 + 0.025 * pulse + 0.18 * rush),
          filter: `blur(${rush * 10}px)`,
        }}
      >
        <Photo
          src="06-hj040-rodaje.jpg"
          focus={[74, 52]}
          zoom={[1.32, 1.5]}
          brightness={base + 0.32 * pulse}
        />
      </AbsoluteFill>

      {/* Cabecera */}
      <div
        style={{
          position: "absolute",
          top: 230,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: interpolate(frame, [10, 30], [0, 1], clamp) * (1 - rush),
        }}
      >
        <div
          style={{
            fontFamily: MONO_FONT,
            fontSize: 30,
            letterSpacing: 10,
            color: AMBER,
          }}
        >
          BITÁCORA DE VUELO
        </div>
        <div
          style={{
            fontFamily: BODY_FONT,
            fontWeight: 300,
            fontSize: 30,
            letterSpacing: 6,
            color: "rgba(255,255,255,0.75)",
            marginTop: 10,
          }}
        >
          SABANA DE BOGOTÁ · COLOMBIA
        </div>
      </div>

      {/* Matrícula */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: 1 - rush,
          scale: String(1 + 0.6 * rush),
        }}
      >
        <div
          style={{
            fontFamily: TITLE_FONT,
            fontSize: 290,
            color: "white",
            lineHeight: 1,
            letterSpacing: interpolate(frame, [BAR, INTRO_END], [70, 12], {
              ...clamp,
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            opacity: flicker(frame - BAR),
            textShadow: `0 0 ${30 + 50 * pulse}px rgba(255,181,71,${0.35 + 0.4 * pulse}), 0 8px 40px rgba(0,0,0,0.7)`,
          }}
        >
          HJ-040
        </div>
        <div
          style={{
            fontFamily: BODY_FONT,
            fontWeight: 500,
            fontSize: 46,
            letterSpacing: 14,
            color: "white",
            marginTop: 10,
            opacity: interpolate(frame, [2 * BAR, 2 * BAR + 20], [0, 1], clamp),
            translate: `0px ${interpolate(frame, [2 * BAR, 2 * BAR + 24], [24, 0], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) })}px`,
          }}
        >
          UN DÍA EN LAS ALTURAS
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

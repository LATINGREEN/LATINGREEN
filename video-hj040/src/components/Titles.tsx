import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { AMBER, BODY_FONT, MONO_FONT, TITLE_FONT } from "../fonts";

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

// Parpadeo tipo letrero de neón / tubo al encender
const flicker = (f: number, start: number) => {
  const local = f - start;
  if (local < 0) return 0;
  const pattern = [1, 0.15, 0.9, 0.1, 1, 0.5, 1];
  return local < pattern.length ? pattern[local] : 1;
};

type SceneTitleProps = {
  label: string;
  title: string;
  sub?: string;
  /** Distancia desde el borde inferior (zona segura para Reels/TikTok). */
  bottom?: number;
  delay?: number;
};

export const SceneTitle: React.FC<SceneTitleProps> = ({
  label,
  title,
  sub,
  bottom = 430,
  delay = 4,
}) => {
  const frame = useCurrentFrame();
  const f = frame - delay;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Degradado inferior para que el texto respire */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 72%, rgba(0,0,0,0.75) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          bottom,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            fontFamily: MONO_FONT,
            fontSize: 30,
            letterSpacing: 6,
            color: AMBER,
            opacity: interpolate(f, [0, 8], [0, 1], clamp),
            translate: `${interpolate(f, [0, 12], [-40, 0], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) })}px 0px`,
          }}
        >
          {label}
        </div>
        <div style={{ overflow: "hidden", paddingTop: 6 }}>
          <div
            style={{
              fontFamily: TITLE_FONT,
              fontSize: 148,
              lineHeight: 0.92,
              color: "white",
              letterSpacing: 2,
              textShadow: "0 6px 30px rgba(0,0,0,0.55)",
              opacity: flicker(f, 4),
              translate: `0px ${interpolate(f, [4, 20], [110, 0], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) })}%`,
            }}
          >
            {title}
          </div>
        </div>
        <div
          style={{
            height: 5,
            backgroundColor: AMBER,
            width: interpolate(f, [10, 30], [0, 240], {
              ...clamp,
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        />
        {sub ? (
          <div
            style={{
              fontFamily: BODY_FONT,
              fontWeight: 300,
              fontSize: 44,
              color: "rgba(255,255,255,0.92)",
              letterSpacing: 1,
              opacity: interpolate(f, [16, 30], [0, 1], clamp),
              translate: `0px ${interpolate(f, [16, 30], [16, 0], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) })}px`,
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// Palabra gigante que "golpea" en el tiempo fuerte (coro)
export const SlamWord: React.FC<{ word: string }> = ({ word }) => {
  const frame = useCurrentFrame();
  const split = interpolate(frame, [0, 10], [20, 0], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background:
          "radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 60%)",
      }}
    >
      <div
        style={{
          fontFamily: TITLE_FONT,
          fontSize: 250,
          letterSpacing: 6,
          color: "white",
          textShadow: `${split}px 0 rgba(255,40,70,0.85), ${-split}px 0 rgba(0,210,255,0.85), 0 10px 50px rgba(0,0,0,0.6)`,
          opacity: interpolate(frame, [0, 2], [0, 1], clamp),
          scale: String(
            interpolate(frame, [0, 7, 60], [1.9, 1, 0.94], {
              ...clamp,
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          ),
        }}
      >
        {word}
      </div>
    </AbsoluteFill>
  );
};

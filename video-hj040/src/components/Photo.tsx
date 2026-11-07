import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Gradación "cine": más contraste, color un poco más rico.
export const GRADE = "contrast(1.14) saturate(1.12) brightness(0.97)";

type Props = {
  src: string;
  /** Punto de interés en % (x, y): centra el encuadre y el zoom ahí. */
  focus?: [number, number];
  zoom?: [number, number];
  /** Desplazamiento en px durante la toma. */
  pan?: [[number, number], [number, number]];
  /** "contain" muestra la foto completa sobre un fondo desenfocado. */
  fit?: "cover" | "contain";
  /** Golpe de zoom al inicio de la toma (para cortes al ritmo). */
  punch?: number;
  brightness?: number;
};

export const Photo: React.FC<Props> = ({
  src,
  focus = [50, 50],
  zoom = [1.04, 1.14],
  pan = [
    [0, 0],
    [0, 0],
  ],
  fit = "cover",
  punch = 0,
  brightness = 1,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const file = staticFile(`photos/${src}`);

  const kenBurns = interpolate(frame, [0, durationInFrames], zoom, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.33, 0, 0.67, 1),
  });
  const punchScale = interpolate(frame, [0, 9], [1 + punch, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const t = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tx = pan[0][0] + (pan[1][0] - pan[0][0]) * t;
  const ty = pan[0][1] + (pan[1][1] - pan[0][1]) * t;

  const imgStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: fit,
    objectPosition: `${focus[0]}% ${focus[1]}%`,
    filter: `${GRADE} brightness(${brightness})`,
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      {fit === "contain" ? (
        <Img
          src={file}
          style={{
            ...imgStyle,
            objectFit: "cover",
            filter: `blur(46px) brightness(${0.45 * brightness}) saturate(1.3)`,
            scale: "1.2",
          }}
        />
      ) : null}
      <AbsoluteFill
        style={{
          transformOrigin: `${focus[0]}% ${focus[1]}%`,
          scale: String(kenBurns * punchScale),
          translate: `${tx}px ${ty}px`,
        }}
      >
        <Img src={file} style={imgStyle} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

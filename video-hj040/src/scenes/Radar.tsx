import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { GRADE } from "../components/Photo";
import { SceneTitle } from "../components/Titles";
import { AMBER, MONO_FONT } from "../fonts";

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

// Captura de la app de rastreo (2436 x 1125 px), mostrada a 1080 px de alto.
const SRC_W = 2436;
const SRC_H = 1125;
const H = 1080;
const S = H / SRC_H;
const W = SRC_W * S;
const TOP = 200;
// Centro de la ficha del avión y posición del icono del avión en el mapa
const CARD_X = 716 * S;
const PLANE_X = 1782 * S;
const PLANE_Y = 532 * S;

export const Radar: React.FC = () => {
  const frame = useCurrentFrame();
  const file = staticFile("photos/03-radar-vuelo.jpg");
  const ease = Easing.bezier(0.65, 0, 0.35, 1);
  const left = interpolate(
    frame,
    [0, 36, 66],
    [540 - CARD_X + 60, 540 - CARD_X - 20, 540 - PLANE_X],
    { ...clamp, easing: ease },
  );
  const zoom = interpolate(frame, [66, 120], [1, 1.45], {
    ...clamp,
    easing: Easing.bezier(0.33, 0, 0.67, 1),
  });
  const ring = (offset: number) => {
    const t = ((frame - 60 + offset) % 30) / 30;
    return frame < 60 ? 0 : t;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      <Img
        src={file}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "75% 50%",
          filter: "blur(50px) brightness(0.4) saturate(1.2)",
          scale: "1.2",
        }}
      />
      <div
        style={{
          position: "absolute",
          left,
          top: TOP,
          width: W,
          height: H,
          transformOrigin: `${PLANE_X}px ${PLANE_Y}px`,
          scale: String(zoom),
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        }}
      >
        <Img
          src={file}
          style={{ width: W, height: H, filter: GRADE, display: "block" }}
        />
        {/* Pulsos de radar sobre el avión */}
        {[0, 10, 20].map((o) => (
          <div
            key={o}
            style={{
              position: "absolute",
              left: PLANE_X,
              top: PLANE_Y,
              width: 40,
              height: 40,
              marginLeft: -20,
              marginTop: -20,
              borderRadius: "50%",
              border: `5px solid ${AMBER}`,
              scale: String(1 + ring(o) * 5),
              opacity: frame < 60 ? 0 : 0.9 * (1 - ring(o)),
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: PLANE_X,
            top: PLANE_Y + 56,
            translate: "-50% 0px",
            fontFamily: MONO_FONT,
            fontSize: 26,
            color: "white",
            backgroundColor: "rgba(0,0,0,0.65)",
            padding: "8px 14px",
            borderLeft: `5px solid ${AMBER}`,
            whiteSpace: "nowrap",
            opacity: interpolate(frame, [70, 80], [0, 1], clamp),
            scale: String(1 / zoom),
            transformOrigin: "50% 0%",
          }}
        >
          HJ-040 · MX80 · RUMBO NORTE
        </div>
      </div>
      <SceneTitle
        label="03 · EN EL AIRE"
        title="SOBRE LA SABANA"
        sub="Chía · Cajicá · Zipaquirá"
        bottom={300}
      />
    </AbsoluteFill>
  );
};

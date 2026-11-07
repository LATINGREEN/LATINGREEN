import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Photo } from "../components/Photo";
import { AMBER, BODY_FONT, MONO_FONT, TITLE_FONT } from "../fonts";

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const Final: React.FC = () => {
  const frame = useCurrentFrame();
  const ease = Easing.bezier(0.16, 1, 0.3, 1);
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Photo
        src="06-hj040-rodaje.jpg"
        fit="contain"
        focus={[50, 50]}
        zoom={[1.5, 1.3]}
        punch={0.08}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 32%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.7) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 300,
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: TITLE_FONT,
            fontSize: 230,
            lineHeight: 1,
            color: "white",
            letterSpacing: interpolate(frame, [0, 60], [40, 10], {
              ...clamp,
              easing: ease,
            }),
            opacity: interpolate(frame, [4, 14], [0, 1], clamp),
            textShadow:
              "0 0 40px rgba(255,181,71,0.45), 0 10px 40px rgba(0,0,0,0.7)",
          }}
        >
          HJ-040
        </div>
        <div
          style={{
            height: 5,
            width: interpolate(frame, [10, 40], [0, 300], {
              ...clamp,
              easing: ease,
            }),
            backgroundColor: AMBER,
            margin: "18px auto 0",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 330,
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: BODY_FONT,
            fontWeight: 500,
            fontSize: 64,
            letterSpacing: 12,
            color: "white",
            opacity: interpolate(frame, [16, 34], [0, 1], clamp),
            translate: `0px ${interpolate(frame, [16, 40], [24, 0], { ...clamp, easing: ease })}px`,
          }}
        >
          CIELOS DE COLOMBIA
        </div>
        <div
          style={{
            fontFamily: MONO_FONT,
            fontSize: 28,
            letterSpacing: 6,
            color: AMBER,
            marginTop: 16,
            opacity: interpolate(frame, [30, 46], [0, 1], clamp),
          }}
        >
          MX80 · SABANA DE BOGOTÁ
        </div>
      </div>
    </AbsoluteFill>
  );
};

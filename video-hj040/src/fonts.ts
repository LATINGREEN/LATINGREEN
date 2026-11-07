import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

export const TITLE_FONT = "Bebas Neue";
export const BODY_FONT = "Oswald";
export const MONO_FONT = "Space Mono";

loadFont({ family: TITLE_FONT, url: staticFile("fonts/BebasNeue.woff2") });
loadFont({
  family: BODY_FONT,
  url: staticFile("fonts/Oswald-300.woff2"),
  weight: "300",
});
loadFont({
  family: BODY_FONT,
  url: staticFile("fonts/Oswald-500.woff2"),
  weight: "500",
});
loadFont({ family: MONO_FONT, url: staticFile("fonts/SpaceMono.woff2") });

export const AMBER = "#FFB547";

import { Composition } from "remotion";
import { DURATION, FPS, HEIGHT, WIDTH } from "./timing";
import { defaultVueloProps, VueloHJ040 } from "./VueloHJ040";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="VueloHJ040"
      component={VueloHJ040}
      durationInFrames={DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={defaultVueloProps}
    />
  );
};

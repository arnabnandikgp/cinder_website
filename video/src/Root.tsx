import "./index.css";
import { Composition, Folder } from "remotion";
import { CinderIntro } from "./CinderIntro";
import { NetworkScene } from "./scenes/NetworkScene";
import { EndCard } from "./scenes/EndCard";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CinderIntro"
        component={CinderIntro}
        durationInFrames={810}
        fps={30}
        width={1920}
        height={1080}
      />
      <Folder name="Scenes">
        <Composition
          id="Network"
          component={NetworkScene}
          durationInFrames={690}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="EndCard"
          component={EndCard}
          durationInFrames={165}
          fps={30}
          width={1920}
          height={1080}
        />
      </Folder>
    </>
  );
};

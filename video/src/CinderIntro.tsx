import { AbsoluteFill, Sequence } from "remotion";
import { Backdrop } from "./components/Backdrop";
import { NetworkScene } from "./scenes/NetworkScene";
import { EndCard } from "./scenes/EndCard";
import { Soundtrack } from "./components/Soundtrack";
import { CinderMark } from "./components/CinderMark";

export const CinderIntro = () => (
  <AbsoluteFill
    style={{ color: "#FAFAFB", fontFamily: "Arial, Helvetica, sans-serif" }}
  >
    <Backdrop />
    <Sequence name="Continuous venue choreography" durationInFrames={690}>
      <NetworkScene includeMark={false} />
    </Sequence>
    <Sequence
      name="Closing identity"
      from={645}
      durationInFrames={165}
      premountFor={30}
    >
      <EndCard includeMark={false} />
    </Sequence>
    <CinderMark />
    <Soundtrack />
  </AbsoluteFill>
);

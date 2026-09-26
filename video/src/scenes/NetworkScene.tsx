import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Backdrop } from "../components/Backdrop";
import { NetworkDiagram } from "../components/NetworkDiagram";
import { CinderMark } from "../components/CinderMark";

const timing = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
  easing: Easing.bezier(0.22, 1, 0.36, 1),
} as const;

const Opening = () => {
  const frame = useCurrentFrame();
  return (
    <Interactive.Div
      name="Opening question"
      style={{
        position: "absolute",
        left: 390,
        top: 340,
        width: 1140,
        fontSize: 112,
        fontWeight: 500,
        letterSpacing: -4.2,
        lineHeight: 1.07,
        textAlign: "center",
        textShadow: "0 3px 40px #0B0B0B",
        opacity: interpolate(frame, [0, 12, 96, 119], [1, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        translate: interpolate(frame, [0, 18], ["0px 14px", "0px 0px"], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      Still juggling
      <br />
      positions across
      <br />
      <span style={{ color: "#6093ff" }}>Solana venues?</span>
    </Interactive.Div>
  );
};

const Introduction = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <Interactive.Div
        name="Introducing Cinder"
        style={{
          position: "absolute",
          left: 260,
          top: 226,
          width: 1400,
          textAlign: "center",
          fontSize: 52,
          letterSpacing: -1,
          color: "#BCC7DA",
          opacity: interpolate(frame, [0, 10, 82, 98], [0, 1, 1, 0], timing),
          translate: interpolate(
            frame,
            [0, 18],
            ["0px 12px", "0px 0px"],
            timing,
          ),
        }}
      >
        Introducing
      </Interactive.Div>
      <Img
        name="Introducing Cinder wordmark"
        src={staticFile("brand/cinder-wordmark.svg")}
        style={{
          position: "absolute",
          left: 755,
          top: 550,
          width: 410,
          height: (410 * 214) / 810,
          objectFit: "contain",
          opacity: interpolate(frame, [5, 15, 82, 98], [0, 1, 1, 0], timing),
        }}
      />
      <Interactive.Div
        name="Prime broker introduction"
        style={{
          position: "absolute",
          left: 260,
          top: 710,
          width: 1400,
          textAlign: "center",
          fontSize: 54,
          letterSpacing: -1.2,
          textShadow: "0 3px 30px #0B0B0B",
          opacity: interpolate(frame, [8, 18, 82, 98], [0, 1, 1, 0], timing),
        }}
      >
        Prime brokerage for{" "}
        <span style={{ color: "#6093ff" }}>Solana perps.</span>
      </Interactive.Div>
    </>
  );
};

const AccountTitle = () => {
  const frame = useCurrentFrame();
  return (
    <Interactive.Div
      name="One account headline"
      style={{
        position: "absolute",
        left: 128,
        top: 385,
        fontSize: 144,
        fontWeight: 500,
        letterSpacing: -5.5,
        lineHeight: 1.05,
        opacity: interpolate(frame, [0, 14, 68, 84], [0, 1, 1, 0], timing),
        translate: interpolate(frame, [0, 25], ["0px 24px", "0px 0px"], timing),
      }}
    >
      One
      <br />
      <span style={{ color: "#6093ff" }}>account.</span>
    </Interactive.Div>
  );
};

const ConnectedTitle = () => {
  const frame = useCurrentFrame();
  return (
    <Interactive.Div
      name="Connected venues headline"
      style={{
        position: "absolute",
        left: 128,
        top: 385,
        fontSize: 132,
        fontWeight: 500,
        letterSpacing: -4.5,
        lineHeight: 1.03,
        opacity: interpolate(frame, [0, 16, 99, 117], [0, 1, 1, 0], timing),
        translate: interpolate(frame, [0, 22], ["0px 22px", "0px 0px"], timing),
      }}
    >
      Connected
      <br />
      <span style={{ color: "#6093ff" }}>venues.</span>
    </Interactive.Div>
  );
};

const VolumeTitle = () => {
  const frame = useCurrentFrame();
  return (
    <Interactive.Div
      name="Pooled volume headline"
      style={{
        position: "absolute",
        left: 128,
        top: 345,
        opacity: interpolate(frame, [0, 16, 104, 122], [0, 1, 1, 0], timing),
        translate: interpolate(frame, [0, 22], ["0px 22px", "0px 0px"], timing),
      }}
    >
      <div
        style={{
          fontSize: 132,
          fontWeight: 500,
          letterSpacing: -5,
          lineHeight: 1.05,
        }}
      >
        Pooled
        <br />
        <span style={{ color: "#6093ff" }}>volume.</span>
      </div>
      <div
        style={{
          fontSize: 48,
          color: "#BDC5D3",
          marginTop: 27,
          letterSpacing: -0.6,
        }}
      >
        Built for better
        <br />
        fee economics.
      </div>
    </Interactive.Div>
  );
};

const PrivacyTitle = () => {
  const frame = useCurrentFrame();
  return (
    <Interactive.Div
      name="Confidential by design headline"
      style={{
        position: "absolute",
        left: 128,
        top: 385,
        fontSize: 126,
        fontWeight: 500,
        letterSpacing: -4.6,
        lineHeight: 1.06,
        opacity: interpolate(frame, [0, 16, 96, 116], [0, 1, 1, 0], timing),
        translate: interpolate(frame, [0, 22], ["0px 22px", "0px 0px"], timing),
      }}
    >
      Confidential
      <br />
      <span style={{ color: "#6093ff" }}>by design.</span>
    </Interactive.Div>
  );
};

export const NetworkScene = ({
  includeMark = true,
}: {
  includeMark?: boolean;
}) => {
  const frame = useCurrentFrame();
  const { id } = useVideoConfig();
  const finish = interpolate(frame, [645, 680], [1, 0], timing);
  return (
    <AbsoluteFill
      style={{ color: "#FAFAFB", fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      {id === "Network" && <Backdrop />}
      <div style={{ opacity: finish }}>
        <NetworkDiagram />
      </div>
      {includeMark && <CinderMark />}
      <Sequence name="Opening hook" durationInFrames={120}>
        <Opening />
      </Sequence>
      <Sequence
        name="Introducing Cinder"
        from={120}
        durationInFrames={98}
        premountFor={30}
      >
        <Introduction />
      </Sequence>
      <Sequence name="Account reveal" from={216} durationInFrames={84}>
        <AccountTitle />
      </Sequence>
      <Sequence name="Venue connections" from={300} durationInFrames={117}>
        <ConnectedTitle />
      </Sequence>
      <Sequence name="Pooled economics" from={417} durationInFrames={123}>
        <VolumeTitle />
      </Sequence>
      <Sequence name="Privacy differentiator" from={540} durationInFrames={117}>
        <PrivacyTitle />
      </Sequence>
    </AbsoluteFill>
  );
};

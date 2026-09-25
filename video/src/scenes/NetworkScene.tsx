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
import { accountPosition, mix, smooth } from "../motion";

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
        opacity: interpolate(frame, [0, 12, 126, 149], [1, 1, 1, 0], {
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
        opacity: interpolate(frame, [0, 18, 108, 126], [0, 1, 1, 0], timing),
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
        opacity: interpolate(frame, [0, 16, 123, 141], [0, 1, 1, 0], timing),
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

export const NetworkScene = () => {
  const frame = useCurrentFrame();
  const { id } = useVideoConfig();
  const account = accountPosition(frame);
  const finish = interpolate(frame, [645, 680], [1, 0], timing);
  return (
    <AbsoluteFill
      style={{ color: "#FAFAFB", fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      {id === "Network" && <Backdrop />}
      <div style={{ opacity: finish }}>
        <NetworkDiagram />
      </div>
      {/* The central mark is carried into the end card without a cut. */}
      <div
        style={{
          position: "absolute",
          left: mix(account.x - 91, 869, smooth((frame - 645) / 44)),
          top: mix(account.y - 102, 225, smooth((frame - 645) / 44)),
          width: 182,
          height: (182 * 754) / 634,
          opacity: interpolate(
            frame,
            [150, 177, 678, 689],
            [0, 1, 1, 0],
            timing,
          ),
          scale: interpolate(frame, [150, 185], [0.7, 1], timing),
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -80,
            background: "radial-gradient(ellipse, #0051fe24, transparent 65%)",
          }}
        />
        <Img
          name="Cinder central mark"
          src={staticFile("brand/cinder-mark.png")}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      </div>
      <Sequence name="Opening hook" durationInFrames={150}>
        <Opening />
      </Sequence>
      <Sequence name="Account reveal" from={150} durationInFrames={126}>
        <AccountTitle />
      </Sequence>
      <Sequence name="Venue connections" from={276} durationInFrames={141}>
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

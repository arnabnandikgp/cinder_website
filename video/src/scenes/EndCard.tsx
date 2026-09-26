import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Backdrop } from "../components/Backdrop";
import { CinderMark } from "../components/CinderMark";

export const EndCard = ({ includeMark = true }: { includeMark?: boolean }) => {
  const frame = useCurrentFrame();
  const { id } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{ color: "#FAFAFB", fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      {id === "EndCard" && <Backdrop />}
      {includeMark && <CinderMark settled />}
      <Img
        name="Closing Cinder wordmark"
        src={staticFile("brand/cinder-wordmark.svg")}
        style={{
          position: "absolute",
          left: 780,
          top: 470,
          width: 360,
          height: (360 * 214) / 810,
          objectFit: "contain",
          opacity: interpolate(frame, [38, 60], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
      <Interactive.Div
        name="Closing product promise"
        style={{
          position: "absolute",
          left: 260,
          top: 625,
          width: 1400,
          textAlign: "center",
          fontSize: 84,
          letterSpacing: -2.5,
          lineHeight: 1.12,
          opacity: interpolate(frame, [32, 55], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [32, 60], ["0px 20px", "0px 0px"], {
            easing: Easing.bezier(0.22, 1, 0.36, 1),
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Building one account
        <br />
        for <span style={{ color: "#6093ff" }}>Solana perps.</span>
      </Interactive.Div>
      <Interactive.Div
        name="Product category"
        style={{
          position: "absolute",
          top: 845,
          left: 260,
          width: 1400,
          textAlign: "center",
          fontSize: 31,
          letterSpacing: 0.5,
          color: "#AAB4C6",
          opacity: interpolate(frame, [42, 62], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Prime brokerage for solana perps
      </Interactive.Div>
      <Interactive.Div
        name="Follow Cinder CTA"
        style={{
          position: "absolute",
          left: 260,
          width: 1400,
          bottom: 96,
          textAlign: "center",
          fontSize: 44,
          color: "#FAFAFB",
          opacity: interpolate(frame, [48, 70], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Follow <span style={{ color: "#6093ff" }}>@CinderExchange</span>
      </Interactive.Div>
    </AbsoluteFill>
  );
};

import {
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { markPosition } from "../motion";

// One persistent image owns the whole journey. In the main film it never
// unmounts, crossfades to a second copy, or resets at the end-card boundary.
export const CinderMark = ({ settled = false }: { settled?: boolean }) => {
  const frame = useCurrentFrame();
  const position = markPosition(settled ? 810 : frame);
  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width: 182,
        height: (182 * 754) / 634,
        opacity: settled
          ? 1
          : interpolate(frame, [120, 138], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
            }),
        scale: settled
          ? 1
          : interpolate(frame, [120, 144], [0.86, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
            }),
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
        name="Continuous Cinder mark"
        src={staticFile("brand/cinder-mark.png")}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
    </div>
  );
};

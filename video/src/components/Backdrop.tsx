import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";

export const Backdrop = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#0B0B0B", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 69% 52%, #101b31 0%, #0b0e15 35%, #0B0B0B 70%)",
          opacity: interpolate(
            frame,
            [0, 210, 660, 810],
            [0.2, 0.85, 0.85, 0.6],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          ),
        }}
      />
      <Img
        src={staticFile("brand/cinder-mark.png")}
        style={{
          position: "absolute",
          width: 1230,
          right: -540,
          bottom: -510,
          opacity: 0.035,
          rotate: "-18deg",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 128,
          top: 96,
          display: "flex",
          gap: 18,
          alignItems: "center",
        }}
      >
        <Img
          src={staticFile("brand/cinder-mark.png")}
          style={{ width: 39, height: (39 * 754) / 634, objectFit: "contain" }}
        />
        <Img
          src={staticFile("brand/cinder-wordmark.png")}
          style={{ width: 164, height: 47, objectFit: "contain" }}
        />
      </div>
    </AbsoluteFill>
  );
};

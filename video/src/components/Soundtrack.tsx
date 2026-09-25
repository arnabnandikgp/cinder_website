import { Audio } from "@remotion/media";
import { interpolate, staticFile, useVideoConfig } from "remotion";

// User-supplied track. This contiguous 62–89s excerpt keeps its original outro,
// whose final impact lands at about 22s in the video, on the closing identity.
// Swap this file/offset independently of the visual timeline.
export const Soundtrack = () => {
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <Audio
      name="Aetheric - Snap Crackle"
      src={staticFile("audio/aetheric-snap-crackle.mp3")}
      trimBefore={62 * fps}
      trimAfter={62 * fps + durationInFrames}
      volume={(frame) =>
        interpolate(
          frame,
          [0, 8, durationInFrames - 18, durationInFrames - 1],
          [0, 0.42, 0.42, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        )
      }
    />
  );
};

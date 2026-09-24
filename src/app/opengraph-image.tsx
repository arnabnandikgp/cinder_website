/* next/og renders images directly; next/image is not supported in ImageResponse. */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Cinder: One account for Solana perps.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const [mark, wordmark, font] = await Promise.all([
    readFile(join(process.cwd(), "public/brand/mark-dark.png")),
    readFile(join(process.cwd(), "public/brand/wordmark-dark.png")),
    readFile(
      join(
        process.cwd(),
        "node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf",
      ),
    ),
  ]);
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#0B0B0B",
        color: "#FAFAFB",
        display: "flex",
        flexDirection: "column",
        padding: "56px 68px",
        fontFamily: "Geist",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <img
        alt=""
        src={markSrc}
        width={660}
        height={735}
        style={{ position: "absolute", right: -135, top: -160, opacity: 0.1 }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <img alt="" src={markSrc} width={41} height={46} />
        <img
          alt="Cinder"
          src={`data:image/png;base64,${wordmark.toString("base64")}`}
          width={128}
          height={37}
        />
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 62,
          color: "#a0a4ad",
          fontSize: 15,
          letterSpacing: 3,
        }}
      >
        A PRIME BROKER FOR SOLANA PERPETUALS
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: 24,
          fontSize: 76,
          lineHeight: 1.13,
          letterSpacing: -4,
        }}
      >
        <span>One account</span>
        <span style={{ color: "#6093FF" }}>for Solana perps.</span>
      </div>
      <div
        style={{
          display: "flex",
          marginTop: "auto",
          paddingTop: 22,
          borderTop: "1px solid #292b30",
          color: "#a0a4ad",
          fontSize: 18,
        }}
      >
        Connected venues. Simpler trading. Aggregated activity.
      </div>
      <div
        style={{
          position: "absolute",
          display: "flex",
          width: 7,
          height: "100%",
          background: "#0051FE",
          left: 0,
          top: 0,
        }}
      />
    </div>,
    {
      ...size,
      fonts: [{ name: "Geist", data: font, weight: 400, style: "normal" }],
    },
  );
}

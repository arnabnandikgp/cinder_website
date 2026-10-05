import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Propagate the approved symbol unchanged. Wordmarks use restored vector outlines.
const root = fileURLToPath(new URL("../", import.meta.url));
const path = (name) => `${root}${name}`;
const markPath = path("cinder_design_system/mark/png/cinder-mark-dark.png");
const mark = await readFile(markPath);
const metadata = await sharp(mark).metadata();
assert.equal(metadata.width, 634);
assert.equal(metadata.height, 754, "Refusing to export the old truncated mark");

await copyFile(markPath, path("public/brand/mark-dark.png"));
await mkdir(path("video/public/brand"), { recursive: true });
await copyFile(markPath, path("video/public/brand/cinder-mark.png"));
// Keep the existing canonical hybrid SVG's original pixels and vector patch.
const svgPath = path("cinder_design_system/mark/svg/cinder-mark-dark.svg");
const svg = (await readFile(svgPath, "utf8")).replace(
  "Review master, not yet propagated.",
  "Approved production master; propagated to website and video.",
);
await writeFile(svgPath, svg);

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const resize = (input, width) =>
  sharp(input).resize({ width }).png().toBuffer();
const lockups = {};
for (const variant of ["dark", "light"]) {
  const wordmarkSvgPath = path(
    `cinder_design_system/wordmark/svg/cinder-wordmark-${variant}.svg`,
  );
  const wordmarkSvg = await readFile(wordmarkSvgPath);
  // A 3x PNG export is genuinely rendered from outlines, never an upscaled bitmap.
  const wordmark = await sharp(wordmarkSvg, { density: 216 }).png().toBuffer();
  await writeFile(
    path(`cinder_design_system/wordmark/png/cinder-wordmark-${variant}.png`),
    wordmark,
  );
  await writeFile(path(`public/brand/wordmark-${variant}.png`), wordmark);
  await copyFile(wordmarkSvgPath, path(`public/brand/wordmark-${variant}.svg`));
  const symbol = await readFile(
    path(`cinder_design_system/mark/png/cinder-mark-${variant}.png`),
  );
  // Retain the existing lockup dimensions and symbol placement. Center the
  // slightly tighter, fragment-free wordmark in its previous lettering area.
  const layouts =
    variant === "dark"
      ? [
          ["horizontal", 642, 300, 198, 40, 40, 335, 267, 112],
          ["stacked", 601, 844, 500, 50, 30, 521, 40, 650],
        ]
      : [
          ["horizontal", 630, 300, 190, 40, 40, 335, 255, 112],
          ["stacked", 810, 963, 632, 89, 0, 810, 0, 749],
        ];
  lockups[variant] = {};
  for (const [
    layout,
    width,
    height,
    symbolWidth,
    symbolLeft,
    symbolTop,
    wordWidth,
    wordLeft,
    wordTop,
  ] of layouts) {
    const png = await sharp({
      create: { width, height, channels: 4, background: transparent },
    })
      .composite([
        {
          input: await resize(symbol, symbolWidth),
          left: symbolLeft,
          top: symbolTop,
        },
        {
          input: await resize(wordmark, wordWidth),
          left: wordLeft,
          top: wordTop,
        },
      ])
      .png()
      .toBuffer();
    lockups[variant][layout] = png;
    await writeFile(
      path(
        `cinder_design_system/logo/png/cinder-logo-${layout}-${variant}.png`,
      ),
      png,
    );
    // The symbol remains a raster; retain the lockup wrapper format honestly.
    await writeFile(
      path(
        `cinder_design_system/logo/svg/cinder-logo-${layout}-${variant}.svg`,
      ),
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image href="data:image/png;base64,${png.toString("base64")}" width="${width}" height="${height}"/></svg>\n`,
    );
  }
}

// Refresh only logo tiles, preserving the overview's typography and palette.
const previewPath = path(
  "cinder_design_system/previews/cinder-design-system-preview.png",
);
const tile = (width, fill) =>
  sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="360"><rect width="${width}" height="360" fill="#FAFAFB"/><rect x="0.5" y="0.5" width="${width - 1}" height="359" rx="18" fill="${fill}" stroke="${fill === "#fff" ? "#d9dce4" : fill}"/></svg>`,
    ),
  )
    .png()
    .toBuffer();
const preview = await sharp(await readFile(previewPath))
  .composite([
    {
      input: await tile(480, "#fff"),
      left: 60,
      top: 150,
    },
    {
      input: await tile(540, "#fff"),
      left: 580,
      top: 150,
    },
    {
      input: await sharp({
        create: { width: 580, height: 370, channels: 4, background: "#FAFAFB" },
      })
        .png()
        .toBuffer(),
      left: 1160,
      top: 150,
    },
    { input: await tile(580, "#252A2E"), left: 1160, top: 150 },
    { input: await resize(lockups.light.stacked, 254), left: 173, top: 178 },
    { input: await resize(lockups.light.horizontal, 420), left: 640, top: 230 },
    { input: await resize(lockups.dark.horizontal, 530), left: 1185, top: 206 },
  ])
  .png()
  .toBuffer();
await writeFile(previewPath, preview);
console.log(
  "Exported unchanged symbol, vector wordmarks, 3x transparent PNGs, lockups and overview.",
);
console.log("Both symbol masters and light-source favicons are unchanged.");

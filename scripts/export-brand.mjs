import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Propagate the approved master. No tracing, recoloring or image generation.
const root = fileURLToPath(new URL("../", import.meta.url));
const path = (name) => `${root}${name}`;
const markPath = path("cinder_design_system/mark/png/cinder-mark-dark.png");
const wordmarkPath = path(
  "cinder_design_system/wordmark/png/cinder-wordmark-dark.png",
);
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
const horizontal = await sharp({
  create: { width: 642, height: 300, channels: 4, background: transparent },
})
  .composite([
    { input: await resize(mark, 198), left: 40, top: 40 },
    { input: await resize(wordmarkPath, 335), left: 267, top: 108 },
  ])
  .png()
  .toBuffer();
// The extra 38px below the restored symbol shifts the wordmark down, preserving
// its original breathing room instead of squeezing or clipping the repaired tip.
const stacked = await sharp({
  create: { width: 601, height: 844, channels: 4, background: transparent },
})
  .composite([
    { input: await resize(mark, 500), left: 50, top: 30 },
    { input: await resize(wordmarkPath, 521), left: 40, top: 644 },
  ])
  .png()
  .toBuffer();
for (const [layout, png, width, height] of [
  ["horizontal", horizontal, 642, 300],
  ["stacked", stacked, 601, 844],
]) {
  await writeFile(
    path(`cinder_design_system/logo/png/cinder-logo-${layout}-dark.png`),
    png,
  );
  // Existing lockup SVGs are raster wrappers; retain that format honestly.
  await writeFile(
    path(`cinder_design_system/logo/svg/cinder-logo-${layout}-dark.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image href="data:image/png;base64,${png.toString("base64")}" width="${width}" height="${height}"/></svg>\n`,
  );
}

// Replace only the dark lockup on the existing design-system overview.
const previewPath = path(
  "cinder_design_system/previews/cinder-design-system-preview.png",
);
const preview = await sharp(await readFile(previewPath))
  .composite([
    {
      input: await sharp({
        create: { width: 535, height: 330, channels: 4, background: "#252A2E" },
      })
        .png()
        .toBuffer(),
      left: 1180,
      top: 190,
    },
    { input: await resize(horizontal, 530), left: 1185, top: 222 },
  ])
  .png()
  .toBuffer();
await writeFile(previewPath, preview);
console.log(
  "Exported approved dark mark, website/video copies, dark lockups and design-system preview.",
);
console.log("Intact light variants and light-source favicons are unchanged.");

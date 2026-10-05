import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const path = (name) => `${root}${name}`;
const expected =
  "9fd9e787e4958207bfca9aa10342cd56713610f5a1332f466ddc280539664004";
for (const name of [
  "cinder_design_system/mark/png/cinder-mark-dark.png",
  "public/brand/mark-dark.png",
  "video/public/brand/cinder-mark.png",
]) {
  const bytes = await readFile(path(name));
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    expected,
    `Unapproved mark: ${name}`,
  );
  const { width, height } = await sharp(bytes).metadata();
  assert.equal(width, 634);
  assert.equal(height, 754);
}
const pairs = [
  ["mark/png/cinder-mark-dark.png", "mark/svg/cinder-mark-dark.svg"],
  [
    "logo/png/cinder-logo-horizontal-dark.png",
    "logo/svg/cinder-logo-horizontal-dark.svg",
  ],
  [
    "logo/png/cinder-logo-stacked-dark.png",
    "logo/svg/cinder-logo-stacked-dark.svg",
  ],
  [
    "logo/png/cinder-logo-horizontal-light.png",
    "logo/svg/cinder-logo-horizontal-light.svg",
  ],
  [
    "logo/png/cinder-logo-stacked-light.png",
    "logo/svg/cinder-logo-stacked-light.svg",
  ],
];
for (const variant of ["dark", "light"]) {
  const svgPath = path(
    `cinder_design_system/wordmark/svg/cinder-wordmark-${variant}.svg`,
  );
  const svg = await readFile(svgPath, "utf8");
  assert.match(svg, /viewBox="0 0 810 214"/);
  assert.doesNotMatch(svg, /<image|<text|<script|<foreignObject|base64/);
  assert.equal((svg.match(/<path\s/g) ?? []).length, 6);
  assert.equal((svg.match(/<ellipse\s/g) ?? []).length, 1);
  for (const letter of ["C", "i dot", "i", "n", "d", "e", "r"]) {
    assert.ok(svg.includes(`aria-label="${letter}"`));
  }
  assert.equal(
    await readFile(path(`public/brand/wordmark-${variant}.svg`), "utf8"),
    svg,
  );
  const pngPath = path(
    `cinder_design_system/wordmark/png/cinder-wordmark-${variant}.png`,
  );
  const png = await readFile(pngPath);
  assert.deepEqual(
    await readFile(path(`public/brand/wordmark-${variant}.png`)),
    png,
  );
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.width, 2430);
  assert.equal(metadata.height, 642);
  assert.ok(metadata.hasAlpha);
  const rendered = await sharp(svgPath, { density: 216 }).png().toBuffer();
  assert.deepEqual(
    png,
    rendered,
    "PNG must be rendered from the vector master",
  );

  // Detect detached fragments in the actual silhouette, not just SVG source.
  // Six letters plus the i dot are exactly seven connected opaque components.
  const { data, info } = await sharp(svgPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const visited = new Uint8Array(info.width * info.height);
  const opaque = (pixel) => data[pixel * 4 + 3] >= 128;
  let components = 0;
  const ink = variant === "dark" ? 255 : 11;
  for (let pixel = 0; pixel < visited.length; pixel++) {
    // Antialiased edge RGB can round while being premultiplied by alpha.
    // Check solid interiors exactly; silhouette counting includes edge pixels.
    if (data[pixel * 4 + 3] === 255) {
      for (let channel = 0; channel < 3; channel++) {
        assert.equal(
          data[pixel * 4 + channel],
          ink,
          "Wordmark must have a flat monochrome fill",
        );
      }
    }
    if (visited[pixel] || !opaque(pixel)) continue;
    components++;
    const stack = [pixel];
    visited[pixel] = 1;
    while (stack.length) {
      const current = stack.pop();
      const x = current % info.width;
      const y = Math.floor(current / info.width);
      const neighbors = [];
      if (x > 0) neighbors.push(current - 1);
      if (x + 1 < info.width) neighbors.push(current + 1);
      if (y > 0) neighbors.push(current - info.width);
      if (y + 1 < info.height) neighbors.push(current + info.width);
      for (const neighbor of neighbors) {
        if (!visited[neighbor] && opaque(neighbor)) {
          visited[neighbor] = 1;
          stack.push(neighbor);
        }
      }
    }
  }
  assert.equal(
    components,
    7,
    "Stray fragments or merged/missing letters in wordmark",
  );
}
for (const [png, svg] of pairs) {
  const render = (name) =>
    sharp(path(`cinder_design_system/${name}`))
      .flatten({ background: "#0B0B0B" })
      .raw()
      .toBuffer();
  const raster = await render(png);
  const vector = await render(svg);
  assert.equal(
    raster.length,
    vector.length,
    `PNG/SVG dimensions differ: ${png}`,
  );
  // A raster inside SVG may round premultiplied edge channels by one level.
  let largestDifference = 0;
  for (let i = 0; i < raster.length; i++) {
    largestDifference = Math.max(
      largestDifference,
      Math.abs(raster[i] - vector[i]),
    );
  }
  assert.ok(
    largestDifference <= 1,
    `PNG/SVG disagreement: ${png} (${largestDifference})`,
  );
}
// These were already derived from the intact light reference, not the clipped dark mark.
assert.deepEqual(
  await readFile(path("public/favicon.ico")),
  await readFile(path("cinder_design_system/favicon/cinder-favicon.ico")),
);
assert.deepEqual(
  await readFile(path("public/apple-touch-icon.png")),
  await readFile(path("cinder_design_system/favicon/cinder-favicon-180.png")),
);
console.log(
  "Symbol unchanged; crisp vector wordmarks match 3x PNGs; no stray fragments; lockups/favicons agree.",
);

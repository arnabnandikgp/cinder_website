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
for (const [png, svg] of [
  ["mark/png/cinder-mark-dark.png", "mark/svg/cinder-mark-dark.svg"],
  [
    "logo/png/cinder-logo-horizontal-dark.png",
    "logo/svg/cinder-logo-horizontal-dark.svg",
  ],
  [
    "logo/png/cinder-logo-stacked-dark.png",
    "logo/svg/cinder-logo-stacked-dark.svg",
  ],
]) {
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
  "Approved master matches website/video; PNG/SVG exports agree; intact favicon copies match.",
);

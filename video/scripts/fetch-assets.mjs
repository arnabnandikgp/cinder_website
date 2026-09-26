// Downloads public brand artwork only. No external assets are loaded at render time.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const get = (url) =>
  execFileSync("curl", ["-fsSL", "--max-time", "45", url], {
    maxBuffer: 10 * 1024 * 1024,
  });
for (const dir of ["public/brand", "public/venues", "public/audio", "out"])
  mkdirSync(path.join(root, dir), { recursive: true });
// The video wordmark is now a cleaned, code-native SVG. Do not replace it with
// the old PNG extraction, which contains damaged edges and a symbol fragment.
for (const kind of ["mark"]) {
  copyFileSync(
    path.join(
      root,
      `../cinder_design_system/${kind}/png/cinder-${kind}-dark.png`,
    ),
    path.join(root, `public/brand/cinder-${kind}.png`),
  );
}

const assets = [
  ["pacifica.svg", "https://www.pacifica.fi/imgs/icon.svg"],
  ["velocity.svg", "https://app.velocity.exchange/favicon.svg"],
  ["phoenix.svg", "https://www.phoenix.trade/img/phoenix-mark-orange-sm.svg"],
  [
    "gmtrade.svg",
    "https://raw.githubusercontent.com/gmsol-labs/gmx-solana-media-kit/main/GMTrade%20Media%20Kit/Symbol%20-%20Brand.svg",
  ],
];
for (const [file, url] of assets) {
  const data = get(url);
  if (!data.toString().includes("<svg")) throw new Error(`Not an SVG: ${url}`);
  writeFileSync(path.join(root, "public/venues", file), data);
  console.log(`Saved ${file}`);
}

// BULK supplies this exact standalone mark inline on its official brand page.
// Remove its page-specific 28px sizing; set currentColor to the official white treatment.
const bulkPage = get("https://www.bulk.trade/brand").toString();
const bulk = bulkPage.match(
  /<svg viewBox="0\.68 7\.96 16\.04 16\.06"[\s\S]*?<\/svg>/,
)?.[0];
if (!bulk)
  throw new Error("BULK brand-page markup changed; review the official kit.");
writeFileSync(
  path.join(root, "public/venues/bulk.svg"),
  bulk.replace(/style="[^"]*"/, 'style="color:#ffffff"'),
);
console.log("Saved bulk.svg");

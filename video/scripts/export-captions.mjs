import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

// captions.json follows Remotion's Caption shape; SRT is a delivery export.
const root = new URL("../", import.meta.url);
const captions = JSON.parse(
  await readFile(new URL("captions.json", root), "utf8"),
);
const stamp = (ms) => {
  const date = new Date(ms);
  return date.toISOString().slice(11, 23).replace(".", ",");
};
let end = 0;
const blocks = captions.map((caption, index) => {
  assert.equal(typeof caption.text, "string");
  assert.ok(
    Number.isInteger(caption.startMs) && Number.isInteger(caption.endMs),
  );
  assert.ok(caption.startMs >= end && caption.endMs > caption.startMs);
  assert.ok(caption.endMs <= 27000);
  assert.equal(caption.timestampMs, null);
  assert.equal(caption.confidence, null);
  end = caption.endMs;
  return `${index + 1}\n${stamp(caption.startMs)} --> ${stamp(caption.endMs)}\n${caption.text}`;
});
await writeFile(new URL("captions.srt", root), `${blocks.join("\n\n")}\n`);
console.log(`Exported ${captions.length} timed captions.`);

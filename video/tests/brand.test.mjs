import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the video wordmark uses clean scalable outlines rather than the damaged bitmap", async () => {
  const svg = await read("../public/brand/cinder-wordmark.svg");
  assert.match(svg, /viewBox="0 0 810 214"/);
  assert.doesNotMatch(svg, /<image|<text|base64/);
  for (const letter of ["C", "i dot", "i", "n", "d", "e", "r"]) {
    assert.ok(svg.includes(`aria-label="${letter}"`));
  }
  for (const file of ["Backdrop.tsx", "../scenes/EndCard.tsx"]) {
    const component = await read(`../src/components/${file}`);
    assert.match(component, /brand\/cinder-wordmark\.svg/);
    assert.doesNotMatch(component, /cinder-wordmark\.png/);
  }
});

test("the full film owns one persistent logo, with no overlapping scene copies", async () => {
  const film = await read("../src/CinderIntro.tsx");
  assert.equal((film.match(/<CinderMark\s*\/>/g) || []).length, 1);
  assert.match(film, /<NetworkScene includeMark=\{false\}/);
  assert.match(film, /<EndCard includeMark=\{false\}/);
  const ending = await read("../src/scenes/EndCard.tsx");
  assert.match(ending, /Prime brokerage for solana perps/);
  assert.doesNotMatch(ending, /PRIME BROKERAGE/);
});

test("Cinder is introduced before the first benefit and pooled inputs use people", async () => {
  const story = await read("../src/scenes/NetworkScene.tsx");
  assert.match(story, /name="Introducing Cinder"/);
  assert.match(story, /Prime brokerage for/);
  const scenes = Array.from(
    story.matchAll(/<Sequence\s+name="([^"]+)"/g),
    (match) => match[1],
  );
  assert.ok(scenes.indexOf("Introducing Cinder") >= 0);
  assert.ok(
    scenes.indexOf("Introducing Cinder") < scenes.indexOf("Account reveal"),
  );
  const network = await read("../src/components/NetworkDiagram.tsx");
  assert.equal((network.match(/<TraderSilhouette/g) || []).length, 1);
});

// Original, deterministic 27-second stereo score. No samples or third-party music.
// Sparse D-minor atmosphere -> a steady pulse -> a D-major/add9 resolving close.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rate = 48000;
const duration = 27;
const left = new Float64Array(rate * duration);
const right = new Float64Array(left.length);
const tau = Math.PI * 2;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const smooth = (n) => {
  const t = Math.min(1, Math.max(0, n));
  return t * t * (3 - 2 * t);
};
const add = (start, length, generator, pan = 0) => {
  const offset = Math.round(start * rate);
  const end = Math.min(left.length, offset + Math.round(length * rate));
  for (let i = offset; i < end; i++) {
    const sample = generator((i - offset) / rate);
    left[i] += sample * Math.sqrt((1 - pan) / 2);
    right[i] += sample * Math.sqrt((1 + pan) / 2);
  }
};

const pad = (start, length, notes, gain) =>
  notes.forEach((midi, index) => {
    const f = hz(midi);
    add(
      start,
      length,
      (t) => {
        const envelope = smooth(t / 1.8) * smooth((length - t) / 2.8);
        const shimmer = Math.sin(tau * f * 1.0017 * t + index) * 0.24;
        const tone =
          Math.sin(tau * f * t) * 0.55 +
          Math.sin(tau * f * 0.998 * t) * 0.2 +
          shimmer;
        return (
          gain *
          envelope *
          tone *
          (0.88 + 0.12 * Math.sin(tau * 0.14 * t + index))
        );
      },
      (index - 1.5) * 0.33,
    );
  });

pad(0, 8.5, [50, 57, 60, 64], 0.036);
pad(5.2, 10, [38, 50, 57, 65], 0.043);
pad(12, 10.8, [43, 50, 57, 62], 0.041);
pad(20.8, 6.2, [38, 54, 57, 64], 0.044);

const pluck = (at, midi, gain, pan, length = 1.4) => {
  const f = hz(midi);
  add(
    at,
    length,
    (t) => {
      const env =
        smooth(t / 0.008) * Math.exp(-t * 4.5) * smooth((length - t) / 0.18);
      return (
        gain * env * (Math.sin(tau * f * t) + 0.2 * Math.sin(tau * f * 2 * t))
      );
    },
    pan,
  );
};

// Uncoordinated opening: sparse, softened tonal ticks at different stereo positions.
[
  [0.35, 74, -0.55],
  [1.45, 69, 0.5],
  [2.6, 76, -0.3],
  [3.75, 72, 0.45],
].forEach(([t, n, p]) => pluck(t, n, 0.065, p));

// Low, warm impact at the central reveal, deliberately without a cinematic boom.
add(
  5,
  1.6,
  (t) =>
    0.27 *
    smooth(t / 0.012) *
    Math.exp(-4.2 * t) *
    Math.sin(tau * (56 * t + 3.5 * (1 - Math.exp(-10 * t)))),
  0,
);
pluck(5.05, 74, 0.12, 0);

// 80 BPM, established only after the separate marks begin to come together.
for (let beat = 0; beat < 21; beat++) {
  const start = 6.75 + beat * 0.75;
  const notes = [50, 57, 62, 57, 53, 60, 65, 60];
  pluck(start, notes[beat % notes.length], 0.1, beat % 2 ? 0.16 : -0.16, 1.5);
  // A quiet, rounded pulse without abrasive hats or high-frequency noise.
  if (beat % 2 === 0)
    add(
      start,
      0.3,
      (t) =>
        0.13 *
        smooth(t / 0.008) *
        Math.exp(-20 * t) *
        Math.sin(tau * (48 * t + 2 * (1 - Math.exp(-18 * t)))),
    );
}

// Connection clicks follow the five staggered SVG reveals.
for (let i = 0; i < 5; i++)
  pluck((284 + i * 15) / 30, 77 + i * 2, 0.048, (i - 2) * 0.23, 0.65);
pluck(14.6, 74, 0.045, -0.35);
pluck(15.1, 77, 0.048, 0.35);
pluck(15.86, 81, 0.06, 0);
pluck(18.2, 69, 0.1, 0, 2);

// Closing cadence: a clear resolution with enough time for the tail to breathe.
[62, 66, 69, 76].forEach((n, i) =>
  pluck(22.1 + i * 0.055, n, 0.11, (i - 1.5) * 0.25, 3),
);

// Short stereo reflections, low-pass character inherited from the soft oscillators.
for (let i = left.length - 1; i >= 0; i--) {
  const delay = Math.round(rate * 0.225);
  if (i >= delay) {
    left[i] += right[i - delay] * 0.18;
    right[i] += left[i - delay] * 0.18;
  }
}
let peak = 0;
for (let i = 0; i < left.length; i++) {
  const t = i / rate;
  const fade = smooth(t / 0.06) * smooth((duration - t) / 1.35);
  left[i] *= fade;
  right[i] *= fade;
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
}
const normalize = 0.72 / peak;
const pcm = Buffer.alloc(left.length * 4);
for (let i = 0; i < left.length; i++) {
  pcm.writeInt16LE(Math.round(left[i] * normalize * 32767), i * 4);
  pcm.writeInt16LE(Math.round(right[i] * normalize * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(rate, 24);
header.writeUInt32LE(rate * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(pcm.length, 40);
const output = fileURLToPath(new URL("../public/audio/", import.meta.url));
mkdirSync(output, { recursive: true });
writeFileSync(`${output}cinder-score.wav`, Buffer.concat([header, pcm]));
console.log(
  `Created ${duration}s stereo score at ${rate}Hz; peak ${20 * Math.log10(0.72)} dBFS.`,
);

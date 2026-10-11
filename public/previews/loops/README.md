# Landing-page product loops

These are silent, guided-camera excerpts of the clean native Recordly captures used in Cinder's launch film. They are recorded product previews, not live market streams. No figures, venue statuses or account records have been replaced.

- `standard.mp4`: `video/public/recordings/standard-sol-5k-native.mp4`, 3–23 seconds. Establish the workspace, focus on venue choice, pan to the actual 5k size entry, then return to the workspace.
- `pro.mp4`: the new `video/public/recordings/pro-sol-100k-landing-native.mp4`, 0.7–19.7 seconds. Retain the real Standard-to-Pro click, leverage change to 25x, Short-to-Long change and 100k preset click, with all three venues already included. Establish the complete graph and table, then focus on the populated ranked comparison before pulling back. This take uses **Live** sampling, not the five-second average. The earlier Pro loop is preserved locally under `video/out/landing-pro-before-new-take.mp4`.
- Remotion owns a single affine camera over each native capture. Quintic easing has no spring overshoot; holds stay stationary through the relevant actions. Matching recorded cursor samples are replayed with the same source clock. The opening and closing camera poses match for looping.
- Camera keys and source trims: `video/src/landing/loops.json`. New Pro capture provenance and actual click times: `video/src/landing/pro-capture.json`. Compositions: `Landing-Standard` and `Landing-Pro` in the existing standalone `video/` project. Every frame stays within the clean trading workspace, excluding browser chrome and recorder controls. The mobile player preserves this same aperture instead of adding another crop. Pro uses a 0.4-second whole-overview dissolve to its genuine opening frame so the repeat does not jump between modes; no figures are replaced and no recorded actions are reversed.
- Output: 1440 × 710, 30fps, H.264 (Standard CRF 23; replacement Pro CRF 21), BT.709, YUV420P, fast-start MP4, no audio. Pro is 19 seconds at natural speed; its source has no baked zooms.
- WebP posters use quality 85. Standard uses its first encoded frame. Pro uses the settled, fully populated overview at 10.4 seconds, so reduced-motion visitors see the comparison rather than the introductory Standard view.

Original recordings stay in the local video project; only these web-sized assets are required for deployment. Playback is muted and inline, pauses offscreen or when inactive, and starts from the poster for reduced-motion users. A manual control remains available.

The Standard preview plays at 1.35× in the website player (approximately 14.8 seconds per loop); Pro remains at 1× so its comparison table can be read. The encoded source assets are unchanged.

To regenerate, from `video/` (repeat with `Landing-Pro` and `pro.mp4`):

```sh
npx remotion render Landing-Standard ../public/previews/loops/standard.mp4 --codec h264 --crf 23 --color-space bt709 --concurrency 1 --media-cache-size-in-bytes 251658240 --offthreadvideo-cache-size-in-bytes 67108864
ffmpeg -y -i ../public/previews/loops/standard.mp4 -frames:v 1 -c:v libwebp -quality 85 ../public/previews/loops/standard.webp
```

For the replacement Pro take, render `Landing-Pro` at CRF 21 with `--image-format=png`, and extract the poster with `ffmpeg -y -ss 10.4 -i ../public/previews/loops/pro.mp4 -frames:v 1 -c:v libwebp -quality 85 ../public/previews/loops/pro.webp`.

Verify the camera boundaries and reading holds with `node --test tests/landing-loops.test.mjs` inside `video/`.

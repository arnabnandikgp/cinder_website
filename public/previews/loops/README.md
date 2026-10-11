# Landing-page product loops

These are silent, guided-camera excerpts of the clean native Recordly captures used in Cinder's launch film. They are recorded product previews, not live market streams. No figures, venue statuses or account records have been replaced.

- `standard.mp4`: `video/public/recordings/standard-sol-5k-native.mp4`, 3–23 seconds. Establish the workspace, focus on venue choice, pan to the actual 5k size entry, then return to the workspace.
- `pro.mp4`: `video/public/recordings/pro-sol-100k-native.mp4`, 57–69 seconds. Establish the populated 100k view, zoom into the full venue comparison, hold it for reading, then pull back. The recorded depth status remains visible.
- Remotion owns a single affine camera over each native capture. Quintic easing has no spring overshoot; holds stay stationary through the relevant actions. Matching recorded cursor samples are replayed with the same source clock. The opening and closing camera poses match for looping.
- Camera keys and source trims: `video/src/landing/loops.json`. Compositions: `Landing-Standard` and `Landing-Pro` in the existing standalone `video/` project. Every frame stays within the clean trading workspace, excluding browser chrome and recorder controls. The mobile player preserves this same aperture instead of adding another crop.
- Output: 1440 × 710, 30fps, H.264, CRF 23, BT.709, YUV420P, fast-start MP4, no audio.
- Matching WebP posters are extracted from the first encoded frame at quality 85.

Original recordings stay in the local video project; only these web-sized assets are required for deployment. Playback is muted and inline, pauses offscreen or when inactive, and starts from the poster for reduced-motion users. A manual control remains available.

To regenerate, from `video/` (repeat with `Landing-Pro` and `pro.mp4`):

```sh
npx remotion render Landing-Standard ../public/previews/loops/standard.mp4 --codec h264 --crf 23 --color-space bt709 --concurrency 1 --media-cache-size-in-bytes 251658240 --offthreadvideo-cache-size-in-bytes 67108864
ffmpeg -y -i ../public/previews/loops/standard.mp4 -frames:v 1 -c:v libwebp -quality 85 ../public/previews/loops/standard.webp
```

Verify the camera boundaries and reading holds with `node --test tests/landing-loops.test.mjs` inside `video/`.

# Cinder Design System

Asset package based on the approved Cinder mark and lockup.

The dark mark's truncated lower-right tip was repaired and approved on 2026-09-25.
The master is now **634 × 754**, with transparent space below the restored tip.
Existing source pixels outside the small repair region are unchanged. Do not use
the old 634 × 706 aspect ratio or recreate exports from the archived dark reference.

`mark/png/cinder-mark-dark.png` is the canonical approved raster. Its SVG is a
hybrid (original raster plus a vector corner repair), not a fully vectorized logo.
Lockup and wordmark SVGs also contain raster images. The light mark and existing
light-source favicons already had an intact tip and remain unchanged.

From the repository root, `node scripts/export-brand.mjs` syncs the approved mark
to the website/video and rebuilds dark lockups and the overview. Run
`node scripts/verify-brand.mjs` to check the master, copies and SVG/PNG agreement.
Original artwork under `assets/reference/` is retained as historical reference.

## Included
- logo/svg and logo/png
- mark/svg and mark/png
- wordmark/svg and wordmark/png
- favicon/ sizes and favicon.ico
- docs/colors.json
- docs/design-tokens.css
- assets/reference/ source references

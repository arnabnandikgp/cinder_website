# Cinder Design System

Asset package based on the approved Cinder mark and lockup.

The dark mark's truncated lower-right tip was repaired and approved on 2026-09-25.
The master is now **634 × 754**, with transparent space below the restored tip.
Existing source pixels outside the small repair region are unchanged. Do not use
the old 634 × 706 aspect ratio or recreate exports from the archived dark reference.

`mark/png/cinder-mark-dark.png` is the canonical approved raster. Its SVG is a
hybrid (original raster plus a vector corner repair), not a fully vectorized logo.
Lockup SVGs still contain raster images of the approved symbol. The light mark
and existing light-source favicons already had an intact tip and remain unchanged.

The wordmark was cleaned up on 2026-10-05. Its canonical SVGs now contain real
letter outlines, not an embedded bitmap or a font. The detached fragment above
the `d` is removed. These reuse the clean lettering previously restored for the
video, preserving the established Cinder wordmark rather than redesigning it.
The website and demo use the SVG directly; transparent PNGs are exported at
**2430 × 642** for social cards and raster-only uses. The symbol is unchanged.
An imagegen cleanup was evaluated but rejected because it introduced edge noise.

From the repository root, `node scripts/export-brand.mjs` syncs the approved mark
to the website/video, exports both wordmark variants, and rebuilds the lockups
and overview. Run `node scripts/verify-brand.mjs` to check the master, copies,
SVG/PNG agreement, and that only six letters plus the `i` dot remain.
Original artwork under `assets/reference/` is retained as historical reference.

## Included
- logo/svg and logo/png
- mark/svg and mark/png
- wordmark/svg and wordmark/png
- favicon/ sizes and favicon.ico
- docs/colors.json
- docs/design-tokens.css
- assets/reference/ source references

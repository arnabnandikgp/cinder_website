# Asset provenance

Downloaded from official product sites / published media kits, 2026-09-25.
All venue marks remain the property of their respective owners. Availability in a public
website or kit does not imply a partnership or blanket permission for co-marketing.
Review applicable brand guidance and confirm any needed permission before public release.

| Local file | Official source | Notes |
| --- | --- | --- |
| `public/brand/cinder-mark.png` | `../cinder_design_system/mark/png/cinder-mark-dark.png` | Approved repaired 634 × 754 Cinder master, copied unchanged. Lower-right tip restored; no other source geometry redrawn. |
| `public/brand/cinder-wordmark.svg` | Lettering in `../cinder_design_system/assets/reference/approved-light-reference.png` | Clean native vector reconstruction against the original letter silhouettes (source region x224–1034, y900–1114). Removes the detached symbol fragment and damaged extraction edges; no replacement font or embedded raster. |
| `public/venues/bulk.svg` | https://www.bulk.trade/brand | Exact standalone inline mark; page-specific 28px size removed, official white treatment via currentColor. |
| `public/venues/pacifica.svg` | https://www.pacifica.fi/imgs/icon.svg | Official SVG app icon, unchanged. |
| `public/venues/velocity.svg` | https://app.velocity.exchange/favicon.svg | Official SVG icon, unchanged. |
| `public/venues/phoenix.svg` | https://www.phoenix.trade/img/phoenix-mark-orange-sm.svg | Official orange mark, unchanged. |
| `public/venues/gmtrade.svg` | https://github.com/gmsol-labs/gmx-solana-media-kit/tree/main/GMTrade%20Media%20Kit | `Symbol - Brand.svg`, unchanged. |
| `public/audio/cinder-score.wav` | `scripts/make-audio.mjs` | Rejected first-draft synthesized score; archived, not used in the current export. |
| `public/audio/aetheric-snap-crackle.mp3` | User-supplied `Aetheric - Snap Crackle (freetouse.com).mp3` | Active soundtrack: Snap Crackle by Aetheric, publisher Free To Use. Original preserved, playback copy unchanged. Both Git-ignored. |

The five venue choices were supplied by the user. None has been independently confirmed as
a live Cinder integration. The on-screen disclaimer was removed at the user's request.
No venue performance/security claims are made or endorsed by the artwork.

`npm run assets` refreshes remote artwork and recopies the local Cinder symbol. It preserves
the repaired vector wordmark instead of reimporting the malformed PNG. This is an
explicit maintenance operation: inspect refreshed assets before rendering or publishing.

## Active music

The ID3 metadata identifies **Snap Crackle** by **Aetheric**, publisher **Free To Use** (2025).
The film uses the source interval 62–89s, not the generated score or the unused Mixkit candidate.
The Mixkit download was moved to ignored `out/references/`; it is not in the composition.

The user supplied the track as royalty-free. Free To Use's [business-use guidance](https://freetouse.com/blog/royalty-free-corporate-background-music)
states that promotional content requires a Commercial Plan or Pro License, not its free UGC
license. Confirm appropriate coverage before publishing. No license has been purchased here.

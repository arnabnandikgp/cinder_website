# Cinder

Source of truth: `cinder_design_system/` and its approved assets.

- Cobalt: #0051FE. The brand accent. In the trading workspace, semantic green (#46D6A1) and red (#FF7085) distinguish bids/buys and asks/sells, respectively; they are not additional marketing accents.
- Black: #0B0B0B. Charcoal: #1F1F1F. Dark surface: #252A2E.
- Off white: #FAFAFB. Light gray: #F4F6F8. Graphite: #6B7280.
- Direction: a private financial institution; precise, restrained, confident.
- Typography: self-hosted Manrope on the marketing page, with a softer geometric character and consistent text roles. The trading workspace retains its Arial-style UI sans-serif and compact technical annotations.
- Marketing surfaces: system-default light/dark themes, off-white or graphite backgrounds, cobalt accents, rounded controls (12px) and showcase panels (24px). The terminal stays dark and information-dense.
- Light-mode depth: alternate off-white reading sections with pale cobalt washes; use a richer ice-blue tint for explanatory panels and selected states. React Bits Beams provides the hero background in the approved cobalt (#0051FE), with theme-aware intensity and a quiet central reading area.
- Use the exact approved logo assets. Oversized crops may be used as background artwork, never as a replacement for the intact primary logo.
- Architecture and financial relationships are native HTML/SVG. Cobalt indicates the selected execution path and private account boundary.
- Motion explains order flow, product interaction and account context. The hero's ambient beams pause offscreen and when the browser is hidden; a static cobalt ribbon fallback replaces WebGL for reduced motion, unavailable graphics or no JavaScript. Muted product recordings pause offscreen and have a manual pause control; the account sequence stops on interaction. Reduced-motion users see static states.
- The brokerage diagram continuously compares neutral direct connections with cobalt Cinder-routed flow, using labelled Today / With Cinder states and a legend. Its quicker forward transformation holds the final result before smoothly returning; it pauses offscreen and has no playback controls. People and agents remain outside the private-account boundary; account records stay individual, and qualifying volume aggregates separately at each venue. The final architecture is the no-JavaScript and reduced-motion state.
- The account walkthrough uses an expanding active description and a vertical timed progress rail on each item. Deliberate selection stops automatic advancement; offscreen or unfocused-browser time does not consume the current step’s remaining time.

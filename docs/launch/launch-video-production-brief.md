# Cinder launch video production brief

The creative direction is locked: a 48-second film for X, combining real Standard and Pro demo recordings with a fully animated Agents segment. This brief tells the founder what to capture in Recordly and defines the scenes to compose in Remotion. It does not authorise publication or change the website.

The film introduces Cinder as a **Solana-native prime broker**. It gives manual traders and trading-agent operators a concrete reason to explore the demo, rather than attempting a complete tutorial.

## Production checkpoint

The founder approved venue-local execution costs for both Pro comparison and router selection. The local implementation uses each venue's midpoint to size the entered USDC exposure and measure spread/depth impact, then adds modeled taker fees. Live figures, five-second averages, curves, ticket and new paper receipts use that basis. The approved film direction and tool split remain unchanged.

The method replaces the signed cross-venue benchmark, rather than clamping negative results. [PerpDexList's public description](https://perpdexlist.com/execution-cost) identifies midpoint-based order-book slippage plus taker fees; this is Cinder's own implementation, not a verified reproduction of its backend. Lowest venue-local friction is not a guarantee of the best absolute fill price. The engineering definition and worked example are recorded in [Order entry and execution decisions](../ux/order-entry-and-execution-decisions.md#pro-presentation).

Local verification is complete: the production build, type checking, lint, formatting and all 299 regression tests passed. The updated desktop comparison was visually inspected. These changes have not yet been pushed or deployed; capture new footage only after the updated demo is published.

Before resuming recording:

1. Publish the locally verified demo when authorised. The calculation approval does not itself authorise a deployment or public post.
2. Check the deployed Pro table says **Spread & impact**, **Fees** and **Execution cost**, with venue-local midpoint context and sampling labels visible. Refresh landing-page captures separately if needed; older screenshots can still show the superseded signed benchmark.
3. Return to the two Recordly takes and the fully animated Remotion Agents segment. The music-rights check below remains outstanding.

## Locked decisions

- Format: 16:9 landscape, 1920 × 1080 final output, 30 fps.
- Length: 48 seconds. Individual cuts can move slightly within that duration once recordings and music are available.
- No voiceover. Short on-screen copy carries the story with sound off; cleared music and restrained effects supply energy.
- Founder: Recordly captures of Standard and Pro only.
- Remotion: introduction, transitions, emphasis over recordings, the entire Agents segment, closing card and final assembly.
- Positioning: “Solana-native prime broker.” No expansion roadmap, “all perps,” guaranteed savings or partnership claims.
- Main action: “Explore the demo” at `cinder.exchange/demo`.
- The existing 27-second introductory film remains unchanged. This is a separate product film using the existing standalone `video/` project and approved brand assets.

## Film timeline

| Time   | Scene and purpose                 | Visual action                                                                                                                                         | On-screen copy                                                                |
| ------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 0–4s   | Introduce Cinder                  | The intact Cinder mark and clean wordmark enter on a black background with restrained cobalt depth. A framed terminal arrives at the end of the hold. | “Solana-native prime broker.”                                                 |
| 4–15s  | Standard shows direct trading     | Real footage: select a venue, enter a market-order size, inspect the compact preview, submit a paper order and see the position.                      | “Standard” and “Choose your venue.”                                           |
| 15–17s | Make the second mode unmistakable | Focus on the actual Standard/Pro control. The Pro selection leads into the comparison workspace.                                                      | “Go Pro.”                                                                     |
| 17–31s | Pro makes comparison tangible     | Real footage: move from 5k to 100k USDC, show the curves and ranked basis-point costs, then emphasise the lowest-cost comparable row.                 | “Compare before you trade.” Then “Spread. Impact. Fees.”                      |
| 31–43s | Explain controlled agent access   | A native animated workflow connects an agent identity, its permissions, Cinder's permission check, an allowed venue and the account activity record.  | “Your agents. Your control.” with “Illustrative workflow” visible throughout. |
| 43–48s | Invite exploration                | The same brand identity settles into a quiet closing card. Hold the readable action and URL.                                                          | “Explore the demo” and “cinder.exchange/demo”                                 |

The Standard/Pro transition comes from a real recorded mode switch. It must not imply that changing modes transfers collateral or alters existing positions.

## Recordly preparation

Use a dedicated demo wallet and connect it before recording. There should be no wallet popup, onboarding tour or welcome dialog in either take. Never record a seed phrase, signing prompt, personal notifications or other private desktop content.

For a clean initial state, use **Reset paper account** in Account only if you want to discard that dedicated wallet's saved paper history. This resets simulated records, not real wallet funds. Return to Trade with the fresh 10,000 simulated USDC account; refresh alone does not reset it.

Use the same browser window dimensions and zoom in both recordings. Prefer a high-resolution native capture, ideally 2560 × 1440 or better, with at least 1920 × 1080 where practical. The whole terminal should fit without horizontal clipping. Do not stretch a differently shaped source to 16:9.

Keep the window focused, hide bookmarks and unrelated tabs, and disable notifications. Export a clean source without a decorative background, baked-in camera tilt, titles or aggressive automatic zoom. Save the Recordly project as well as the video so framing can be revised. Keep the cursor normal-sized and move deliberately.

Before the full takes, make a short test export and inspect the numbers at full size. Text clarity matters more than adding capture effects. Leave about three seconds of stillness at the start and end of each take, and pause after each important action. Record longer than the final scene; the edit will remove waits and typing pauses.

Keep Cinder's **Demo** indicator visible. Trading shown here is paper execution using public market data, not a real-money trade.

## Standard recording

Record one continuous take of approximately 35–50 seconds. Its final edit uses about 11 seconds.

1. Start in Trade, Standard, SOL-PERP, Buy / Long, Market, with requested leverage set to 25x. Leave Reduce Only and TP/SL off to keep this introduction focused.
2. Begin with another live venue selected, then open the full-width venue selector. Pause briefly so the names and logos are visible, select Pacifica and wait for its chart and order book to load.
3. Enter **5,000 USDC** notional. Pause on the preview showing order value, estimated additional margin, estimated fees and slippage. Keep the default 0.5% maximum slippage unless the genuine current preview requires otherwise; do not force a submission through an error.
4. Click **Place buy order** once. Wait for the demo to confirm its simulated result.
5. Hold on the resulting position in the records area. If necessary, select Positions and scroll just enough to show it clearly. Do not depict an unconfirmed or rejected order as filled.
6. End with the cursor resting away from important numbers.

The main focal points are the venue selector, the USDC size and preview, and the resulting paper position. Account, Activity, advanced order types and wallet connection do not need separate recordings for this film.

If a live feed is unavailable, wait or retry the capture rather than hiding its status. If the layout requires more scrolling than fits this sequence, capture the position hold separately as a pickup with the same wallet and paper order; do not reconstruct a position in animation.

## Pro recording

Record a second continuous take of approximately 35–50 seconds. Its final edit uses the two-second transition and about 14 seconds of comparison.

1. Start in the same Standard workspace after the first take. Pause, click **Pro** and let the actual transition finish. Standard and Pro have separate ticket inputs, so explicitly set the Pro ticket rather than expecting the Standard size to carry over.
2. Keep SOL-PERP, Buy / Long and 25x requested leverage. Leave Pacifica, BULK and Phoenix allowed, and select **Execution cost**.
3. Select **5s average** and the **5k** quick-size preset. Wait for the sampling status to show a usable comparison and hold a readable frame.
4. Select **100k**. Wait for the comparison to update and the sampling window to become usable, then hold for at least six seconds with the curves, selected-size marker and ranked venue table visible.
5. Move the cursor toward, but not over, the blue highlighted lowest-cost comparable venue. Pause. Do not open extra breakdowns or tooltips for the main take.
6. End on the complete Pro comparison. A second Pro order submission is not needed; the comparison is this scene's main point.

The **100,000 USDC is notional exposure**, not account cash, an investment return or a demonstrated executable maximum. The requested leverage is a demo preview, not a claim that every venue supports that leverage for every account.

Use the actual winner and numbers at recording time. Do not preselect BULK or any other venue as the winner. The display is ranked by venue-local spread/depth impact plus modeled fees among comparable venues, not absolute fill price. Keep **Each venue’s midpoint** visible; do not describe the lowest friction as guaranteed savings. Unavailable venues are not zero-cost alternatives. If 100k lacks a usable comparison, record a 25k backup and flag it for the edit rather than fabricating missing estimates.

The averaged chart/table and the live order ticket can legitimately show different estimates. Keep the **5s average** and **Ticket uses live books** labels visible when those views share a frame. A close-up of the comparison must retain its sampling context and basis-point units, and must not be labelled an executable quote.

The comparison's modeled volume-tier fee assumption and exclusion of Cinder pricing must remain legible in the comparison context. Do not turn a captured estimate into a universal fee or savings claim.

## Animated Agents segment

No Recordly capture is needed. Compose this sequence directly in Remotion using the visual language of the existing landing-page agent diagram, not its browser animation timings.

| Time within the film | Main focal point        | Animation and labels                                                                                                                                                           |
| -------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 31–34s               | Agent identity          | A restrained “SOL Arbitrage” identity card enters beneath “Your agents. Your control.” Use a small geometric identity mark rather than a large robot illustration.             |
| 34–37s               | Permission scope        | Attach a concise permission strip: “SOL-PERP,” “Trade · Cancel” and “Order limits.” Keep a lock label, “No withdrawal authority,” visible.                                     |
| 37–40s               | Cinder permission check | An order request travels from the agent to the Cinder boundary. “Within scope” appears; the request continues to one allowed perp venue. Avoid a spray of simultaneous routes. |
| 40–43s               | Account visibility      | A compact Activity record enters: actor “SOL Arbitrage,” action “SOL order forwarded.” The route settles and the account record becomes the final focal point.                 |

Keep **Illustrative workflow** visible throughout. This scene explains the intended permission relationship; it is not evidence of deployed authorization checks, real agent trading or completed settlement. The existing website diagram is a design reference, not backend verification.

Show one permitted request, not both a passing and failing story in twelve seconds. The locked withdrawal label and constrained permission strip communicate boundaries without adding another narrative branch. Do not invent PnL, transaction hashes, returns, execution latency or a successful fill. Final permission wording must be checked against the implementation before public release.

## Composition and motion

Use Cinder's established black `#0B0B0B`, charcoal `#1F1F1F`, off-white `#FAFAFB` and cobalt `#0051FE`. Green and red stay semantic within trading footage. Use the approved clean vector wordmark and intact mark, with Arial-style typography and tabular financial numbers.

Limit emphasis to two families: shallow perspective/depth movement and selective cobalt glow. Product frames can enter at a slight tilt, but settle straight before viewers read numbers or watch clicks. Keep one main focal point per shot and leave room for short copy outside the product frame.

Frame recordings in a minimal dark container. Start with terminal context, then zoom into the venue control, ticket preview or ranked costs when needed. Important source text must become readable through framing, not through invented overlays replacing the UI.

For the Pro emphasis, freeze one genuine source frame and lift an exact crop of its best comparable row forward briefly. Keep the sampling context visible, then return the crop to its original position before footage resumes. Never animate a live crop independently of changing underlying numbers, splice prices from different timestamps, or redraw the cost curve.

Aim for headline text of at least 56px and supporting labels of at least 28px in the final 1080p composition. Give each short line a readable hold; inspect a phone-sized preview before release. All Remotion motion must be driven by composition frames rather than browser timers or CSS transitions.

## Asset handoff

Send the clean Standard and Pro exports plus their Recordly projects. Suggested video names are `standard-sol-5k.mp4` and `pro-sol-100k.mp4`. Include any position pickup or 25k backup separately, and say which takes are preferred. No Agents recording is required.

The Remotion edit can reuse the approved local assets in `video/public/brand/` and the Pacifica, BULK and Phoenix marks in `video/public/venues/`. Venue marks identify the displayed market-data sources; they must not imply a partnership or live brokerage execution integration. Do not carry the earlier film's five-venue network into this demo as evidence of current support.

The soundtrack is the one outstanding creative asset. Choose a track cleared for promotional use and retain its licence evidence with the assets. Do not automatically reuse the previous soundtrack merely because it was described as royalty-free. We can prepare a silent assembly while that is resolved, but public release requires the applicable music and sound-effect rights.

## Production order and release checks

1. Founder records the two takes and supplies the clean exports and projects.
2. Assemble a timing cut in the existing standalone Remotion project and build the Agents scene. Preserve the earlier film and its assets.
3. Review the cut for readable framing, truthful demo/estimate labels, actual venue rankings and coherent transitions before adding final audio timing.
4. Export the final landscape film and a thumbnail from a genuine Pro frame. Inspect the exported file, not only the Studio preview.
5. Confirm music and sound-effect rights, agent permission wording and venue-brand usage before publication. Uploading or posting remains a separate explicit action.

The final review must check that no simulated action looks like a real-money confirmation, no stale or averaged estimate is sold as guaranteed execution, no mode switch appears to move collateral, and no personal wallet or desktop data is exposed. The CTA and URL should hold for at least three seconds and remain readable with sound off.

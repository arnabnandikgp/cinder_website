# Cinder

A responsive homepage and interactive trading-workspace prototype for Cinder, a prime broker being built for Solana perpetuals. Built with Next.js App Router, TypeScript, Motion, and the approved assets in `cinder_design_system/`.

## Run locally

Requires Node.js 20.9 or newer; Node.js 22 LTS or newer is recommended.

```sh
npm ci
npm run dev
```

Open http://localhost:3000 or http://localhost:3000/demo. The public demo has a chart-first layout, with Trade, Account, Activity and Agents views.

## Deploy to Vercel

1. Import this repository into Vercel.
2. Use the **Next.js** framework preset and the repository root as the root directory.
3. Keep the default build command (`npm run build`) and output settings.
4. Optionally set `NEXT_PUBLIC_SITE_URL` to override the default production origin, `https://cinder.exchange`, for canonical and social-preview URLs. No other environment variables or services are required.
5. Deploy.

The pages and social-preview image are generated at build time. Fonts are self-hosted, and artwork is served through Next.js image optimization. The demo uses TradingView Lightweight Charts with public Pacifica, BULK and Phoenix feeds. Pro compares visible books with live or five-second-average analysis and labelled volume-tier fee assumptions. Wallet connection unlocks 10,000 simulated USDC, stored per wallet in this browser with Reset paper account in Account. Supported simulated orders update the same positions, history, capital and activity ledger. There is no wallet signing, real deposit or live order submission. Advanced execution strategies and agent authorizations remain local previews. Market data connects directly from the visitor's browser; venue origin restrictions, outages and rate limits can affect availability.

## Content and design

- `src/app/page.tsx`: landing-page content and FAQs.
- `src/app/globals.css` and `src/app/product.css`: homepage layout, design tokens, and animation styles.
- `src/app/demo/`: public prototype route, scoped styles, loading and error states.
- `src/components/demo/`: sample data, chart, order ticket, records, account, activity and local-only dialogs.
- `src/components/brokerage-diagram.tsx`: private account records, Cinder order flow and venue-level execution diagram.
- `src/components/agent-access-diagram.tsx`: permission-scoped agent request animation.
- `src/components/header.tsx`: desktop and mobile navigation.
- `src/lib/site.ts`: official Docs, X, GitHub, contact, launch-video and article destinations.
- `src/app/opengraph-image.tsx`: branded social card.
- `cinder_design_system/`: original approved identity, preserved as supplied.
- `public/brand/`: copies of approved logo assets used on the page.
- `public/art/cobalt-architecture.png`: generated atmospheric hero artwork. See [art direction and exact generation prompt](docs/art-direction.md).

The frontend design guidelines informed semantic controls, visible keyboard focus, contrast, responsive layouts and motion handling. The homepage leads with **Solana-native prime brokerage**, then explains privacy and collective fee access before showing Standard/Pro, programmatic agent access and account-wide visibility. Private account records and shared venue execution are distinct in the architecture diagram; volume combines per eligible venue, not across venues. A compact devnet/demo status and resource section replaces the large article promotion. FAQs explain venue visibility, fee assumptions and operator-assisted recovery without promising universal lowest fees or unconditional self-service exits. The four static screenshots come from the actual demo; text links, not the images, open the workspace. The workstation keeps the cobalt/graphite identity without promotional background artwork.

The terminal uses semantic green/red candles, depth and buy/sell actions. Book bars encode cumulative quantity from the spread, while Size is quantity at a single level. The demo fills the desktop viewport with independently scrolling panels and no surrounding review toolbar or footer. The homepage FAQ and order/funding dialogs retain prototype boundaries. TradingView's logo remains in the chart, and its notice and link are available from the chart's attribution control; this is the open-source chart renderer, not Pacifica's embedded Advanced Charts terminal or a live integration. Review scenarios remain available through URL parameters, documented in the trader review guide, rather than a public scenario picker.

In Standard mode, chart and order book follow the execution venue. Pro retains an independent live price-chart tab alongside the execution-cost comparison; returning to Standard re-syncs the chart to the execution venue. Account equity, available margin and position margin requirements all derive from the same simulated ledger and current available marks. Venue bars group position requirements, not editable collateral allocations or shared native venue margin.

The price chart uses a dedicated candle palette, subdued grid and separate resizable volume pane. Reset returns to a width-aware recent-candle window and default pane proportions; Auto fits visible highs/lows without changing horizontal zoom. Venue/timeframe changes reset the viewport, while ordinary feed updates preserve it. Keyboard controls: +/− zoom, left/right pan, Home reset, A auto-scale and Shift+up/down resize volume. These changes retain Lightweight Charts and the existing venue feeds; they do not add Advanced Charts or drawing tools.

## Venue-first order entry and strategy previews

Standard keeps a full-width execution-venue selector above margin/leverage, Market/Limit/Advanced, and direction. Fresh-book Bid/Mid/Ask shortcuts set a limit once. Order entry is USDC-only in Standard and Pro, including advanced portions and Iceberg displayed size. Size means requested notional exposure, not margin or an exact fee-inclusive spend. Venue/market changes preserve the entered USDC amount; Standard and Pro retain separate drafts when switching modes. Reviews and Activity keep the USDC intent. Existing base-denominated positions and venue book sizes are unchanged.

The Advanced menu offers Scale, Chase, TWAP, VWAP, Chase TWAP, Iceberg and Swarm as configurable **local plans**. `strategies.ts` validates inputs and allocates preview quantities; `strategy-controls.tsx` renders the keyboard-accessible menu, relevant fields and plan details. Saved plans reserve simulated funds and appear in Activity, but never run or submit children. VWAP uses a labelled illustrative volume profile. Preview precision, child-count bounds, time-in-force choices and leverage are not verified venue capabilities. Cross describes the simulated account model; it does not imply that native venues share collateral. The paper model is not production risk or settlement accounting.

See [order entry and execution decisions](docs/ux/order-entry-and-execution-decisions.md) for current preview limitations and the backend requirements: capability gating, customer risk, durable workers, parent/child lifecycle, retries, cancellation, omnibus allocation and fee attribution. Tests in `tests/order-entry.spec.ts` and `tests/strategy-plans.spec.ts` cover plan arithmetic, validation, saved receipts, mode preservation, responsive layout and accessibility. This pass does not add cost-history collection or a dedicated depth-comparison view.

## Pro live comparison

- `src/components/demo/live-routing.ts`: deterministic, read-only book walking, fee-inclusive entry prices, quality gates, similarity policy and cost-versus-size curves. `routing.ts` retains the original fictional model for regression tests and legacy draft types; the live Pro UI never calls it for quotes.
- `market-data/adapters.ts` / `feed.ts`: Pacifica, BULK and Phoenix decoding and transport. Comparison feeds request depth rather than chart history. Public depth is not assumed to be complete. Analytical sampling stops outside Pro; connected paper positions can retain feeds for valuation.
- `market-data/fees.ts`: the lowest active published volume-tier taker rates for Pacifica and BULK, and Phoenix's public market fee. Eligibility is **assumed**, not verified for Cinder or the visitor. Fee information controls expose the basis and qualification. Rates refresh every minute and expire after five minutes; errors never fall back to zero. Cinder pricing, funding and exit costs are excluded, not promised free.
- `comparison-analysis.ts`: aligned observations every 250 ms, published once per second. The five-second analysis requires at least 16 shared valid slots out of 20. Missing coverage is labelled, not zero-filled. Feed validity overrides a retained analytical frame; the order ticket always revalidates live data.
- Each venue sizes entered USDC exposure at **its own book midpoint**, then walks asks for buys or bids for sells, including partial last levels. Spread/depth impact plus modeled fees gives nonnegative execution friction in bps for valid uncrossed books and nonnegative fees. The router uses this same venue-local objective: it does not guarantee the best absolute fill price across dislocated markets. Curves stop at observed capacity. See [the current calculation and worked example](docs/ux/order-entry-and-execution-decisions.md#pro-presentation).
- Differences within 0.5 bps or one cent are labelled similar; preference order breaks the tie without claiming a cost advantage. This is a UI policy, not a statistical confidence interval.
- Supported paper orders submit directly without an extra review modal. Submission rechecks fresh books, fees, tolerance and simulated margin, then records the outcome in the browser-local ledger. No live execution occurs. Native size increments, actual customer pricing, production funding/risk and price-protected venue submission remain backend work. Preview arithmetic uses JavaScript numbers, not authoritative settlement accounting.

Calculation and browser tests cover fee parsing, aggregate VWAP cases, partial depth, sell-side signs, stale/skewed books, missing fees, venue-local costs, ties, feed cleanup and saved Activity receipts. The external raw two-hour dataset was not available here; aggregate fixtures are **not** a replay of that recording. No persistent collection service or cost-history database is introduced.

The homepage and social card use the same Solana-native prime broker positioning. The secondary hero action opens the founder-supplied published launch-video post. X and Contact link to https://x.com/CinderExchange; no Telegram or signup destination is fabricated. Product architecture is distinct from the frontend demo's simulated execution.

## Verify

```sh
npm run lint
npm run typecheck
npm run build
npm run format:check
```

With the local server running:

```sh
npm run test:e2e
```

The browser tests use an installed Google Chrome by default. Alternatively, install Playwright Chromium with `npx playwright install chromium`, then run `PLAYWRIGHT_CHANNEL=chromium npm run test:e2e`. Set `TEST_BASE_URL` to test another local server or a preview deployment.

The checks cover mobile through 1920px layouts, viewport fit, accessibility, navigation, official links, keyboard-operated tabs, manual chart/execution sync, independent chart choice in Auto-route, margin/position reconciliation, draft validation, partial fills and cancellation, account/activity consistency, empty/stale states and local-only interactions. Screenshots and failing-test traces are written to the ignored `test-results/` folder.

Refresh the homepage screenshot from the running demo:

```sh
node scripts/capture-demo.mjs
```

The capture script requires Node.js 22.18+ (native TypeScript stripping). It opens an isolated browser and a test wallet whose signing methods throw, skips the invitation through its normal button, waits for populated candles plus live chart and order-estimate feeds, and places one **simulated** 5,000 USDC market order. This updates `public/previews/cinder-trade.png` with a 2x capture of the actual Standard terminal. Account and Activity show that same simulated trade. The script uses real public feeds, never synthetic market prices. Images are staged in a temporary directory until capture succeeds, preventing Next's image hot reload from interrupting the session. Review frames are saved to `test-results/review/`. See the [trader review guide](docs/ux/trader-review.md) for a short moderated session.

To refresh only the focused landing-page feature previews without replacing the hero:

```sh
node scripts/capture-demo.mjs --features
```

This exports `cinder-pro.png`, `cinder-agents.png`, `cinder-account.png` and `cinder-activity.png` into `public/previews/`. Pro uses a 100,000 USDC BTC order and the actual five-second averaging control; unavailable public feeds remain visibly unavailable. Use `node scripts/capture-demo.mjs --pro` to refresh just that image, or `--agents` to capture the complete Agents view for reference without starting market feeds. The landing page uses Standard, Pro, Account and Activity screenshots. Its Agents section instead uses a native permission-flow diagram: an allowed SOL request travels to a venue; an out-of-scope BTC request stops at Cinder; both are attributable in Activity. The illustration never submits requests, pauses off-screen or on demand, and stays static for reduced-motion users. Screenshots are static; separate text links provide navigation. Preview and production boundaries stay in the FAQs.

Use `node scripts/capture-demo.mjs --all` to refresh both the Standard hero and all four feature images together. Account captures its capital summary and position margin requirements; Activity captures the filters and up to six ledger events; Agents captures its complete view for reference. These previews come from the actual interface, not a separate mockup.

The account workspace uses neutral near-black surfaces and flat sections. Margin meters represent position requirements by venue, not collateral budgets, equity shares or withdrawable capital. The Activity ledger separates time, event, actor, venue and result; Cinder-level events without venue admission remain attributed to Cinder. Agent allowance meters reflect the sample grant's remaining accepted-order count and stay explicitly historical for expired grants. This landing-page revamp does not change terminal trading or accounting behavior.

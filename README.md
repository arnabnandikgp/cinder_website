# Cinder

A responsive homepage and interactive trading-workspace prototype for Cinder, a prime broker being built for Solana perpetuals. Built with Next.js App Router, TypeScript, Motion, and the approved assets in `cinder_design_system/`.

## Run locally

Requires Node.js 20.9 or newer; Node.js 22 LTS or newer is recommended.

```sh
npm ci
npm run dev
```

Open http://localhost:3000 or http://localhost:3000/demo. The public demo has one chart-first layout, with Trade, Account and Activity views.

## Deploy to Vercel

1. Import this repository into Vercel.
2. Use the **Next.js** framework preset and the repository root as the root directory.
3. Keep the default build command (`npm run build`) and output settings.
4. Optionally set `NEXT_PUBLIC_SITE_URL` to override the default production origin, `https://cinder.exchange`, for canonical and social-preview URLs. No other environment variables or services are required.
5. Deploy.

The pages and social-preview image are generated at build time. Fonts are self-hosted, and artwork is served through Next.js image optimization. The demo uses TradingView Lightweight Charts with public Pacifica, BULK and Phoenix feeds. Pro compares visible books with live or five-second-average analysis and labelled volume-tier fee assumptions. Account records are fictional. Real wallet connection is supported, but there is no signing, order submission or trading backend. Drafts and agent-authorization previews remain local and disappear on refresh. Leverage is a draft preference, not a validated venue limit or margin calculation. Market data connects directly from the visitor's browser; venue origin restrictions, outages and rate limits can affect availability.

## Content and design

- `src/app/page.tsx`: landing-page content and FAQs.
- `src/app/globals.css` and `src/app/product.css`: homepage layout, design tokens, and animation styles.
- `src/app/demo/`: public prototype route, scoped styles, loading and error states.
- `src/components/demo/`: sample data, chart, order ticket, records, account, activity and local-only dialogs.
- `src/components/diagrams.tsx`: native React/SVG product illustrations.
- `src/components/header.tsx`: desktop and mobile navigation.
- `src/lib/site.ts`: official X, GitHub, contact and published article destinations.
- `src/app/opengraph-image.tsx`: branded social card.
- `cinder_design_system/`: original approved identity, preserved as supplied.
- `public/brand/`: copies of approved logo assets used on the page.
- `public/art/cobalt-architecture.png`: generated atmospheric hero artwork. See [art direction and exact generation prompt](docs/art-direction.md).

The frontend design guidelines informed semantic controls, visible keyboard focus, contrast, responsive layouts, and motion handling. The homepage uses a screenshot of the actual chart-first demo, not an alternative marketing mockup. It gives direct traders and trading-agent users equal emphasis through dedicated Trading and Agents sections, followed by Account, Activity, pooled fee economics, privacy and the published X article. Longer-term clearing ambitions and prototype boundaries live in the FAQs. The privacy map supports hover, keyboard focus, and tap. The workstation keeps the cobalt/graphite identity without promotional background artwork.

The terminal uses semantic green/red candles, depth and buy/sell actions. Book bars encode cumulative quantity from the spread, while Size is quantity at a single level. The demo fills the desktop viewport with independently scrolling panels and no surrounding review toolbar or footer. The homepage FAQ and order/funding dialogs retain prototype boundaries. TradingView's logo remains in the chart, and its notice and link are available from the chart's attribution control; this is the open-source chart renderer, not Pacifica's embedded Advanced Charts terminal or a live integration. Review scenarios remain available through URL parameters, documented in the trader review guide, rather than a public scenario picker.

In Standard mode, chart and order book follow the execution venue. Pro retains an independent live price-chart tab alongside the execution-cost comparison; returning to Standard re-syncs the chart to the execution venue. Account shows committed margin by venue from the same position fixtures used in trading records (800 USDC on Pacifica, 1,800 on BULK, zero on Velocity; all zero for an empty account). These are illustrative allocations, not calculated margin requirements or cross-venue margining.

The price chart uses a dedicated candle palette, subdued grid and separate resizable volume pane. Reset returns to a width-aware recent-candle window and default pane proportions; Auto fits visible highs/lows without changing horizontal zoom. Venue/timeframe changes reset the viewport, while ordinary feed updates preserve it. Keyboard controls: +/− zoom, left/right pan, Home reset, A auto-scale and Shift+up/down resize volume. These changes retain Lightweight Charts and the existing venue feeds; they do not add Advanced Charts or drawing tools.

## Venue-first order entry and strategy previews

Standard keeps a full-width execution-venue selector above margin/leverage, Market/Limit/Advanced, and direction. Fresh-book Bid/Mid/Ask shortcuts set a limit once. Order entry is USDC-only in Standard and Pro, including advanced portions and Iceberg displayed size. Size means requested notional exposure, not margin or an exact fee-inclusive spend. Venue/market changes preserve the entered USDC amount; Standard and Pro retain separate drafts when switching modes. Reviews and Activity keep the USDC intent. Existing base-denominated positions and venue book sizes are unchanged.

The Advanced menu offers Scale, Chase, TWAP, VWAP, Chase TWAP, Iceberg and Swarm as configurable **local plans**. `strategies.ts` validates inputs and allocates preview quantities; `strategy-controls.tsx` renders the keyboard-accessible menu, relevant fields and plan details. Plans can be reviewed and saved into Activity, but never run or submit children. VWAP uses a labelled illustrative volume profile. Preview precision, child-count bounds, time-in-force choices and leverage are not verified venue capabilities. Cross is a static demo label; customer margin calculations and cross-venue netting are not implemented.

See [order entry and execution decisions](docs/ux/order-entry-and-execution-decisions.md) for current preview limitations and the backend requirements: capability gating, customer risk, durable workers, parent/child lifecycle, retries, cancellation, omnibus allocation and fee attribution. Tests in `tests/order-entry.spec.ts` and `tests/strategy-plans.spec.ts` cover plan arithmetic, validation, saved receipts, mode preservation, responsive layout and accessibility. This pass does not add cost-history collection or a dedicated depth-comparison view.

## Pro live comparison

- `src/components/demo/live-routing.ts`: deterministic, read-only book walking, fee-inclusive entry prices, quality gates, similarity policy and cost-versus-size curves. `routing.ts` retains the original fictional model for regression tests and legacy draft types; the live Pro UI never calls it for quotes.
- `market-data/adapters.ts` / `feed.ts`: venue decoding and transport. Pro opens two book-only streams (Pacifica aggregation 1, BULK up to 1,000 unaggregated levels); it does not download candle history until the price-chart tab is selected. Feeds stop when leaving Trade. Returned depth is not assumed to be complete.
- `market-data/fees.ts`: Pacifica `/info/fees` tier 0 and BULK `/feeState` base tier, including active instrument overrides. Fetched every minute, maximum permitted age five minutes; errors never fall back to zero fees. Fee basis, source URL and timestamps are retained with saved estimates. These are public venue fees, **not Cinder account-specific or customer pricing**. Cinder charges, builder fees, discounts, funding and exit costs are excluded, not promised free.
- Freshness: both source and receipt age must be at most 2 seconds, cross-venue skew at most 1 second, future timestamps at most 500 ms ahead. Out-of-sync comparisons are withheld. A single available estimate is not advertised as savings. These preview thresholds require empirical validation before execution.
- The USDC notional is converted once at the shared live midpoint into the same base quantity for every venue (using a USD/USDC parity assumption for this preview). Leverage does not multiply that exposure. Live estimates can update the derived quantity, but never the entered USDC intent. Reviewed receipts freeze both intent and comparison. Partial last levels are consumed, but incomplete orders are never ranked. Curves stop at captured capacity and support negative reference costs. The shared midpoint is for cost attribution, not a guarantee of fair value or profit.
- Differences within 0.5 bps or one cent are labelled similar; preference order breaks the tie without claiming a cost advantage. This is a UI policy, not a statistical confidence interval.
- Review rechecks wall-clock freshness and freezes the quote and fee basis in the local draft. No execution occurs. Native size increments, actual customer charges, per-venue funding/margin and risk, position-aware closing, and price-protected order submission remain backend work. Preview arithmetic uses JavaScript numbers, not authoritative settlement accounting.

Calculation and browser tests cover fee parsing, the handoff's published aggregate VWAP cases, partial depth, sell-side fee signs, stale/skewed books, missing fees, negative costs, ties, feed cleanup and frozen Activity receipts. The external raw two-hour dataset was not available here; the aggregate fixtures are **not** a replay of that recording. No persistent collection service or cost-history database is introduced.

The homepage leads with one trader-facing account, connected venue access, and trading economics, then explains confidential order handling and the longer-term clearing ambition. Venue names and volume bars are conceptual; connected integrations, fee-tier eligibility, routing results, TEE privacy properties, and future clearing capabilities require product-level verification before stronger claims are made. X and Contact link to https://x.com/CinderExchange. GitHub links to https://github.com/arnabnandikgp/cinder. Early access remains absent because there is no signup destination.

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

This updates `public/previews/cinder-trade.png` with a 2x capture of the actual Standard terminal, including the current header, mode controls and Agents tab. It skips the first-visit invitation through its normal button, waits for populated candles and live ticker/book data, and selects Market entry without placing an order. It also saves Pro, Account, Activity, Agents and desktop/mobile review frames in `test-results/review/`. Run against working public venue feeds; the script does not substitute synthetic prices to generate the hero. See the [trader review guide](docs/ux/trader-review.md) for a short moderated session. The earlier three-layout study remains isolated in `ux/terminal-study/`; only chart-first is exposed at `/demo`.

To refresh only the focused landing-page feature previews without replacing the hero:

```sh
node scripts/capture-demo.mjs --features
```

This exports `cinder-pro.png`, `cinder-agents.png`, `cinder-account.png` and `cinder-activity.png` into `public/previews/`. Pro uses a 100,000 USDC BTC order and the actual five-second averaging control; unavailable public feeds remain visibly unavailable. Use `node scripts/capture-demo.mjs --pro` to refresh just that image, or `--agents` to capture the complete Agents view for reference without starting market feeds. The landing page uses Standard, Pro, Account and Activity screenshots. Its Agents section instead uses a native permission-flow diagram: an allowed SOL request travels to a venue; an out-of-scope BTC request stops at Cinder; both are attributable in Activity. The illustration never submits requests, pauses off-screen or on demand, and stays static for reduced-motion users. Screenshots are static; separate text links provide navigation. Preview and production boundaries stay in the FAQs.

Use `node scripts/capture-demo.mjs --all` to refresh both the Standard hero and all four feature images together. Account captures its capital summary and venue allocations; Activity captures the filters and first six ledger events; Agents captures the complete view, including its directory, permissions, remaining allowance and recent activity. These previews come from the actual interface, not a separate mockup.

The account workspace uses neutral near-black surfaces and flat sections. Allocation meters represent each venue's share of committed margin, not shares of equity or withdrawable capital. The Activity ledger separates time, event, actor, venue and result; Cinder-level events without venue admission remain attributed to Cinder. Agent allowance meters reflect the sample grant's remaining accepted-order count and stay explicitly historical for expired grants. No grant, order, transfer or accounting behavior changes as part of this visual design.

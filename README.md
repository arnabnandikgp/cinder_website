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

The pages and social-preview image are generated at build time. Fonts are self-hosted, and artwork is served through Next.js image optimization. The demo uses TradingView Lightweight Charts with deterministic synthetic OHLCV and fictional account records. It has no live Pacifica or other venue feed, wallet integration, signing, order submission or backend. Drafts remain in memory and disappear on refresh. Auto-route is labelled as a future interaction concept. The leverage selector is a draft preference, not a validated venue limit or margin calculation.

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

The frontend design guidelines informed semantic controls, visible keyboard focus, contrast, responsive layouts, and motion handling. The homepage uses a screenshot of the actual chart-first demo, not an alternative marketing mockup. It introduces the account workflow, pooled fee economics, privacy, longer-term direction and an editorial card linking to the published X article. The privacy map supports hover, keyboard focus, and tap. The workstation keeps the cobalt/graphite identity without promotional background artwork.

The terminal uses semantic green/red candles, depth and buy/sell actions. Book bars encode cumulative quantity from the spread, while Size is quantity at a single level. The screenshot captures only the intended product interface; the demo's explanatory note and homepage FAQ identify it as a prototype. TradingView attribution is retained in the chart and below the demo; this is the open-source chart renderer, not Pacifica's embedded Advanced Charts terminal or a live integration.

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

The checks cover mobile through 1440px layouts, horizontal overflow, accessibility, navigation, official links, keyboard-operated tabs, chart/execution independence, draft validation, partial fills and cancellation, account/activity consistency, empty/stale states and local-only interactions. Screenshots and failing-test traces are written to the ignored `test-results/` folder.

Refresh the homepage screenshot from the running demo:

```sh
node scripts/capture-demo.mjs
```

This updates `public/previews/cinder-trade.png` and saves desktop/mobile review frames in `test-results/review/`. See the [trader review guide](docs/ux/trader-review.md) for a short moderated session. The earlier three-layout study remains isolated in `ux/terminal-study/`; only chart-first is exposed at `/demo`.

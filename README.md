# Cinder

A responsive landing page for Cinder, a prime broker layer being built for Solana perpetuals. Built with Next.js App Router, TypeScript, Motion, and the approved assets in `cinder_design_system/`.

## Run locally

Requires Node.js 20.9 or newer; Node.js 22 LTS or newer is recommended.

```sh
npm ci
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel

1. Import this repository into Vercel.
2. Use the **Next.js** framework preset and the repository root as the root directory.
3. Keep the default build command (`npm run build`) and output settings.
4. Set `NEXT_PUBLIC_SITE_URL` to the final production origin, including `https://`, to enable the canonical URL and absolute social-preview URLs. No other environment variables or services are required.
5. Deploy.

The page and social-preview image are generated at build time. Fonts are self-hosted, and the hero artwork is served through Next.js image optimization. This repository does not contain a trading app, wallet integration, signup form, or backend.

## Content and design

- `src/app/page.tsx`: landing-page content and FAQs.
- `src/app/globals.css`: responsive layout, design tokens, and animation styles.
- `src/components/diagrams.tsx`: native React/SVG product illustrations.
- `src/components/header.tsx`: desktop and mobile navigation.
- `src/lib/site.ts`: official X, GitHub, and contact destinations.
- `src/app/opengraph-image.tsx`: branded social card.
- `cinder_design_system/`: original approved identity, preserved as supplied.
- `public/brand/`: copies of approved logo assets used on the page.
- `public/art/cobalt-architecture.png`: generated atmospheric hero artwork. See [art direction and exact generation prompt](docs/art-direction.md).

The frontend design guidelines informed semantic controls, visible keyboard focus, contrast, responsive layouts, and motion handling. Only the diagrams animate: hero routing loops continuously; execution and pooled volume play once on entry; pooled volume has a replay control. Reduced-motion users receive static states. Small screens use a vertical hero flow. The privacy map supports hover, keyboard focus, and tap.

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

The checks cover 375px, 768px, and 1280px layouts, horizontal overflow, accessibility, FAQ keyboard interaction, mobile navigation, privacy visibility, official link destinations, and reduced-motion/offscreen behavior. Screenshots and failing-test traces are written to the ignored `test-results/` folder.

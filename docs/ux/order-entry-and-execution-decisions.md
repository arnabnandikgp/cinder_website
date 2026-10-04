# Cinder order entry and execution decisions

Updated 4 October 2026. For the founder, frontend developer and backend implementation owner.

This document records the direction for Cinder's Standard and Pro trading experiences, the advanced strategy previews implemented locally in `/demo`, and the execution requirements that must be resolved before those controls can place real orders. It is a product and engineering handoff, not a claim of implemented trading capabilities or deployment status.

The central decision is to keep venue selection, execution strategy and customer risk distinct. Standard makes the chosen venue prominent. Pro compares eligible venues for an immediate entry. Advanced strategies describe how an order is worked; they are not alternatives to routing.

## Decision status

| Item                                                                           | Status                                                                            |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Chart-first Standard, with Account and Activity as separate top-level views    | Established product direction                                                     |
| Keep Standard and Pro as distinct experiences                                  | Latest founder direction; retain for this iteration                               |
| Full-width execution-venue dropdown above Standard order controls              | Implemented in the local demo; sticky within the desktop ticket                   |
| Market and Limit tabs higher in the ticket                                     | Implemented above direction and size                                              |
| Advanced strategy options may be explored in the demo without live submission  | Seven configurable local previews, review and saved Activity receipts implemented |
| Call the strategy menu Advanced rather than Pro                                | Implemented, to avoid two meanings of Pro                                         |
| Keep the present Pro comparison and route estimate                             | Founder direction; do not replace it with a fixed venue picker                    |
| Cost history and optional visible depth                                        | Recommended extensions; not approval to start a persistent collector              |
| Exact customer margin policy, strategy semantics and production support matrix | Unresolved backend decisions                                                      |

This supersedes the earlier suggestion to replace the Standard/Pro switch with Choose venue/Smart route for the next UI iteration. The conceptual separation between routing and strategy remains. It also permits explicitly identified strategy previews in the demo despite the earlier research documents' stricter rule against displaying unconfirmed order types. Production capability gating remains required.

## Current local baseline

The local working tree has a Standard venue chart and order book backed by public Pacifica, BULK and Phoenix data, and a Pro comparison using visible books and public base fee schedules. Velocity remains an unsupported market-data preview. Pro evaluates immediate market entries, not resting limits or scheduled strategies. Venue data availability does not prove execution availability.

### Phoenix public market-data integration

- Direct browser REST/WS, no wallet, API key, signing or order submission. No Rise SDK runtime dependency is needed for this read-only adapter; its wire types and official docs are the protocol reference.
- REST candles: `https://perp-api.phoenix.trade/v1/candles/{symbol}` with `timeframe`, millisecond bounds and `enableExternalSource=false`. Live `candles` subscriptions return `candle` frames with second timestamps. Both normalize to UTC candle seconds. History and live bars merge by time; external backfills are rejected.
- Use the timestamped `l2Book` stream (`coin`), not the untimestamped `orderbook` channel, for both Standard and Pro. Books are complete, ordered visible snapshots with source seconds and Solana slots. Replace atomically and reject malformed/crossed levels, foreign symbols, time or slot regressions and execution-band bypasses. Visible combined FIFO/spline levels are consumed once; raw spline regions and hidden take amounts are not added.
- Market stats expose mark, oracle, funding, 24h change and USD volume. Raw market frames have no source timestamp; receipt time is used for ticker display health only, never as evidence of Pro book freshness. Funding stays venue-labelled with no inferred hourly conversion and is excluded from entry-cost estimates.
- Metadata is cached per market. Native `tickSize` is quote lots per base lot, not dollars. USDC quote lots use six decimals; SOL's observed `tickSize=100`, `baseLotsDecimals=2` means a $0.01 increment, while BTC's four base decimals mean $1. Limits remain illustrative in the ticket, not approved production risk controls.
- Fee metadata comes from `/v1/view/exchange/market/{symbol}`. Observed `takerFee=0.00035` is a fraction (3.5 bps), despite the generated endpoint docs' percentage label. Read the active market's public fee; missing, expired, inactive or mismatched metadata cannot become zero fees. No pooled-volume or referral discount is assumed.
- Phoenix joins Pacifica and BULK in route preferences, the same-quantity comparison, cost curves and saved receipts. Source/receipt freshness and skew gates use the comparison policy below. Do not relabel these estimates executable quotes. Public data integration does not implement brokerage, collateral movement, venue order placement or account-state syncing.

### Pro comparison continuity and freshness

The live diagnostic on 4 October reproduced global blanking in 70 of 191 post-warm-up samples: latest-only source/receipt skew invalidated every venue. Pacifica/BULK delivered books approximately every 200–250ms, Pacifica source age occasionally reached 1.4s, and Phoenix delivered less frequently, with an observed gap above 5s. These are observations from one short session, not service-level guarantees.

A follow-up live session after this change had no fully blank plots in 194 post-warm-up samples: 132 had three fresh curves, 60 had two, and two had one. Delayed observations remained labelled and excluded. Genuine feed interruptions can still limit or halt recommendations; preserving the plot does not remove that constraint.

- Comparison feeds retain accepted L2 observations in memory, bounded to 128 frames and 10 seconds per feed. Chart feeds do not retain depth history. Reconnection clears the window.
- Ranking uses the largest pairwise-aligned cohort of fresh observations, breaking coverage ties by the newest minimum receive timestamp. It can select a slightly older accepted frame instead of racing independently arriving latest frames. A third venue outside that cohort cannot veto an aligned pair.
- Fresh ranking still requires receipt age at most 2s and source/receipt alignment within 1s. Whole-second Phoenix source timestamps represent a one-second interval, not millisecond precision: source age permits that quantization, while receipt age remains capped at 2s. Every selected book, timestamp and fee is validated. Source/receipt ages in the expanded methodology refer to the actual selected snapshots.
- Delayed or unaligned observations may remain in the chart/table for at most 10s since receipt, with a dashed curve and an explicit delayed label. Their costs are recomputed for the same displayed quantity/reference, but they **never enter rankings, savings, route recommendations or review**. The reference can be labelled last-observed when no current cohort exists; the actionable reference remains unavailable. Offline/reconnecting feeds, invalid books/timestamps, missing/expired fees and excluded venues cannot get a delayed display fallback.
- Eligible venue rows are ordered by unrounded entry cost, lowest first. Equal-cost rows and unranked rows retain their venue order; delayed, excluded and unavailable venues follow the eligible rows and never enter the ranking. Curve visibility remains presentation-only. No fictional prices, added depth, order execution, automatic collateral movement or guarantees are introduced.
- Order review recalculates against current feed states and wall-clock time; a displayed observation is not authority to submit an order. Production must repeat validation server-side against destination state and enforce the customer's actual price bound.

### Customer slippage control

Slippage is adverse fill-price movement relative to an explicitly identified decision/reference price. Estimated average slippage and the worst permitted fill price are distinct; fees are separate. A 0.5% price tolerance at a $120 reference gives a maximum buy price of $120.60 or minimum sell price of $119.40 before fees. It is a price guard, not a promise that the order fills.

The demo's Standard maximum-slippage and Pro price-tolerance fields are local preview controls, not live venue enforcement. Production should expose one consistent maximum-slippage control, show its derived price bound, record the reference, expiry and customer intent, and preserve that bound across route selection. Round buy caps down and sell floors up to permissible venue ticks. Never silently widen tolerance or rebase an authorized order to a new price.

Pacifica accepts `slippage_percent` as a decimal percentage string (`"0.5"`); BULK's market action accepts optional `slippage` in basis points (`50` = 0.5%, absent uses the market default); Phoenix Rise builds a market IOC packet with `priceLimitUsd` and minimum-fill controls. Native reference-price conventions and partial-fill behaviour need integration tests; sending the same percentage blindly is not proof of a common customer price bound. Where appropriate, use an explicit price-limited IOC rather than relying on a venue's default market-order protection.

References: [Pacifica market-order request](https://docs.pacifica.fi/api-documentation/api/websocket/trading-operations/create-market-order), [BULK official action schema](https://docs.bulk.trade/api-reference/openapi.yaml), [BULK time-in-force](https://docs.bulk.trade/bulk-exchange/Order-Types), [Phoenix Rise order-packet builder](https://github.com/Ellipsis-Labs/rise-public/blob/master/ts/src/orderPackets.ts). This records backend requirements; it does not add order submission to the demo.

References: [Rise SDK](https://github.com/Ellipsis-Labs/rise-public), [exchange feeds](https://docs.phoenix.trade/sdk/markets), [candles](https://docs.phoenix.trade/api/exchange/get-candles), [spline liquidity](https://docs.phoenix.trade/phoenix/matching-engine/spline-liquidity), [fees](https://docs.phoenix.trade/phoenix/matching-engine/fees). Regression coverage: `tests/phoenix.spec.ts`, alongside existing feed and routing suites.

Order review and saved drafts are local interactions. Private account records are simulated; there is no live signing or order submission in this demo. Standard now includes Scale, Chase, TWAP, VWAP, Chase TWAP, Iceberg and Swarm previews. Historical cost charts and a dedicated depth comparison have not been added. These statements concern the local source, not the currently deployed website.

Relevant implementation: `src/components/demo/order-ticket.tsx`, `strategy-controls.tsx`, `strategies.ts`, `terminal.tsx`, `demo-dialogs.tsx`, `pro-workspace.tsx`, `live-routing.ts`, `route-card.tsx` and `market-data/`; styling in `src/app/demo/order-entry.css`.

### Implemented preview boundaries

- The margin row displays **Cross** as a static demo label, without a margin-mode selector. Customer margin policy remains a backend decision; the label does not imply cross-venue offsets. Requested leverage is retained in the draft but does not produce a margin or liquidation estimate.
- Standard price shortcuts use a fresh visible book. All order size fields use USDC notional exposure, including advanced allocations, Iceberg displayed size, and reduction previews. This is not margin or a guaranteed fee-inclusive spend. Venue and market changes preserve the entered USDC amount; live reference prices never overwrite it. Position and venue book quantities remain base-denominated.
- Standard and Pro retain separate draft state. First entry into Pro carries over side, USDC size and requested leverage; subsequent switches preserve each mode's edits. Changing the market resets price and strategy parameters, not the USDC amount. Strategy types currently share a parameter object, not independent per-strategy drafts. Pro converts the USDC intent once per comparison at the shared live midpoint, using USD/USDC parity for this preview, then compares the same base quantity on every venue. Reviews freeze the intent, derived quantity and reference; leverage never multiplies the exposure.
- Scale allocates a linear price ladder with an end/start size-weight ratio. Timed previews allocate slices from offset zero at the chosen interval. VWAP uses an explicitly labelled synthetic volume profile, not collected venue-volume history. Optional size variation is deterministic; it does not randomize timing.
- Iceberg shows displayed portions and a possible final remainder, without predicting when they fill. Chase describes a bounded parent intent, not an actual repricing worker or live queue position. Swarm displays paced clips, not evidence of reduced impact.
- Preview arithmetic conserves USDC notional at eight-decimal precision. Production must derive each child quantity from its applicable price and venue lot size; a Scale ladder allocates USDC amounts, not equal base quantities at different prices. The eight-decimal preview is not a token transfer precision rule. UI bounds (up to 100 Scale/Swarm children, up to 200 timed slices/iceberg portions, and 24 hours for timed plans) protect the prototype; they are not venue rules or approved production limits. Tick/lot rounding, minimum notionals, customer positions and margin are not checked.
- Limit, Scale and Iceberg expose draft time-in-force preferences; Iceberg excludes IOC. Reduce-only is a requested intent, not a validated customer position check. Other strategy semantics in the table below remain backend decisions, including Chase expiry and actual post-only behaviour.
- **Preview plan → Save local plan** freezes the reviewed parameters and allocation into an Activity receipt marked **Not submitted**. No children enter Open orders, no fills or fees are manufactured, and a refresh clears the in-memory plans.

Regression coverage lives in `tests/order-entry.spec.ts` and `tests/strategy-plans.spec.ts`: all seven plan/save flows, total-size conservation, invalid inputs, fixed receipts, independent modes, venue/chart sync, keyboard menu behaviour, and accessibility at 375/768/1280/1440 px. Existing Standard and Pro suites continue to cover market feeds and route estimates.

## Standard ticket layout

Keep the Standard/Pro switch as the workspace mode control. Inside the Standard ticket, the first form control should be a full-width execution-venue dropdown. It stays above the margin/leverage row and every order-type form.

Suggested order:

1. Execution venue, for example **Pacifica**, with a persistent label and dropdown affordance.
2. Customer-applicable margin mode and requested leverage.
3. **Market / Limit / Advanced** tabs, with the active strategy name replacing Advanced after selection and the menu remaining accessible.
4. Buy/Long and Sell/Short.
5. Available collateral and the customer's position in this venue and contract, when known.
6. Type-specific inputs, size with explicit units, optional size slider and applicable protection controls.
7. Order or strategy preview and the review action.

Market has size and execution protection inputs. Limit puts price above size, with side-aware Bid/Ask and Mid shortcuts drawn from a fresh book, not an unlabeled mark-price substitute. Strategy selection changes the fields, not the execution venue.

Keep the venue header visible while scrolling a tall ticket where the layout permits. The review receipt must repeat venue and contract identity; do not rely on a header that is no longer visible in a modal.

### Venue and mode changes

Changing the Standard venue must synchronize the chart and book, invalidate prior reviews, refresh applicable limits and capabilities, and revalidate inputs. Preserve harmless intent such as side and USDC notional where possible; do not silently retain an invalid leverage, price increment or unsupported strategy. A selected type that is unavailable on the new venue needs an explanation rather than silent substitution.

A price shortcut is a deliberate one-time action, not permission to keep moving a user's limit price. Changing sizing units must preserve the intended exposure and disclose the conversion reference.

Preserve separate Standard and Pro draft state. Switching back must not overwrite a Standard limit or strategy plan with Pro's Market settings. Require a new review after consequential changes.

## Pro ticket and workspace

Keep the current cost-versus-size analysis, comparison table and entry estimate. In the same top-of-ticket position occupied by Standard's venue dropdown, show **Smart route** and a count of included venues. Opening it edits the permitted venue set, not a single forced destination.

Show **Estimated destination: BULK**, for example, in the route result. Distinguish included venues from venues currently eligible at this size; fresh books, complete visible depth and public fees are only the current analytical checks. Production eligibility also needs customer risk, venue collateral and order support.

Keep Pro Market-only for this iteration. The Advanced previews live in Standard first. Future strategies may use either a fixed venue or routing, but this requires an explicit routing policy and must not be inferred from showing an Advanced menu.

During editing, the estimate may change with market data. On review, freeze the displayed inputs, timestamps and fee basis. Before future submission, the backend must revalidate and either respect the authorized bounds or request a revised review. A frozen preview is not an executable quote.

## Margin and venue identity

A prominent venue selector helps identify execution context. It does not prove that customer losses are isolated to that venue or that venue-native margin controls map directly to a customer's Cinder account.

Use three separate concepts:

- **Execution venue:** where this order is sent.
- **Customer margin policy:** which part of this customer's collateral supports the exposure and how liquidation is determined.
- **External venue margin arrangement:** how Cinder's own omnibus account or account tree is margined by the venue.

The customer-facing margin policy must come from Cinder. Do not copy the third concept into the UI as if it were the second.

### Proposed labels pending backend confirmation

If the approved customer policy is cross margin within a venue-scoped allocation, use **Cross · Pacifica**, not an unqualified Cross. Suggested explanation: “Shares margin across your Pacifica positions. Does not provide margin offsets against positions on other venues.” This text is conditional on the actual policy; it is not an established architecture fact.

If that policy is unresolved, use an explicitly illustrative margin preview or leave the setting unavailable. Do not add a working-looking Cross/Isolated switch merely to match a reference screenshot. Isolation is a financial guarantee about scope that needs implementation evidence.

In Pro, associate any margin estimate with the estimated destination. Before a destination exists, do not imply a universal cross-margin pool. Show requested leverage separately from eligible leverage limits.

A user changing leverage must not directly mutate a shared venue-account setting that changes another customer's risk. Similarly, reduce-only must be checked against the individual customer's position; a native reduce-only flag against net omnibus exposure is not sufficient to establish the correct customer result.

## Advanced strategy previews

Use one compact **Strategy preview** indicator in the Advanced form and an explicit local-plan outcome at review. Avoid a large repeating disclaimer, but do not label a local plan running, submitted or filled. A user should be able to explore the intended workflow without mistaking a product concept for an available execution service.

| Strategy   | Inputs to explore                                                                          | Honest local preview                                                                                            | Backend decision required                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Scale      | Total size, start/end price, number of orders, size distribution, relevant time in force   | Limit ladder with levels, quantities and allocated total                                                        | Tick/lot rounding, minimum child size, margin reservation, partial batch failure and cancellation scope             |
| Chase      | Total size, maximum chase price/distance, duration or expiry, breach action                | Initial intended resting price and explicit chasing boundary                                                    | Repricing cadence, post-only behaviour, queue effects, partial fills and cancel/replace races                       |
| TWAP       | Total size, duration, interval or slice count, price protection, optional randomization    | Planned schedule and size per slice                                                                             | Missed slices, catch-up policy, price pauses, expiry and execution ownership                                        |
| VWAP       | Total size, duration, declared volume profile, price protection                            | Illustrative allocation schedule only when a labelled profile exists; otherwise inputs and unavailable schedule | Source and quality of volume history, benchmark, prediction model, live adaptation and participation limits         |
| Chase TWAP | TWAP schedule plus passive chasing and explicit catch-up policy                            | Schedule with passive and possible catch-up phases                                                              | Conditions permitting taker execution, aggregate protection, deadlines and maker/taker costs                        |
| Iceberg    | Total size, limit price, displayed portion, relevant time in force, optional randomization | Displayed portion and planned replenishments                                                                    | Native versus synthetic implementation, replenishment trigger, queue priority, partial fills and total exposure cap |
| Swarm      | Total size, number of clips, pace, price protection, optional randomization                | Clip schedule and estimated duration, not predicted fills                                                       | Rate limits, in-flight exposure, stop conditions and whether actual impact improves                                 |

These are proposed Cinder controls, not promises of parity with Hyperlink or native API support across venues. Do not copy reference-product duration bounds, leverage limits, fee discounts or privacy badges without establishing Cinder's semantics.

Validate inputs and conserve the intended total in previews. Label any schedule fixture or randomized preview as illustrative. Do not manufacture future fill prices, guaranteed maker execution, liquidation values or savings. Book-walking VWAP is an estimated average fill today; it is not a VWAP scheduling algorithm.

## Backend execution contract

The implementation owner should define and version these requirements before a preview can submit orders:

1. **Capabilities:** per venue and market, distinguish available public data, native order primitives, Cinder-managed strategies and unsupported combinations. Include margin modes, leverage bounds, tick/lot sizes, minimums, time-in-force and trigger sources.
2. **Customer intent and authorization:** a durable parent instruction identifies customer, market, side, target quantity or notional semantics, strategy, venue scope, risk scope, expiry and price limits. Prevent duplicates with stable identifiers. Keep customer instructions separate from external omnibus orders.
3. **Lifecycle:** track acceptance, working quantity, partial fills, cancellation requested, confirmed cancellation, completion and uncertain outcomes. Acknowledgement is not a fill. Query/reconcile uncertain results before resubmitting.
4. **Execution ownership:** decide whether the venue or Cinder runs a strategy. Cinder-managed execution needs a durable worker outside the browser and beyond a single short-lived web request. Closing a tab must not silently terminate a live strategy. Restart behaviour must be explicit.
5. **Risk and reservation:** reserve against the customer's obligations, enforce the aggregate parent budget across all in-flight children, and check destination collateral before routing. Account for working orders, fees and protective orders. Cross-venue capital movement is a separate authorized operation.
6. **Strategy safety:** specify scheduling, allowed lateness, partial-fill allocation, cancel/replace sequencing, retry limits, price-bound enforcement, pause/cancel semantics, kill switches and behaviour during venue outages. Pausing new submissions must not be confused with cancelling resting children.
7. **Omnibus allocation:** deterministically attribute fills, fees and funding to customers, enforce customer-specific reduce-only, address self-trade prevention and net external exposure, and prevent one customer's control changes from altering another's entitlement or risk unexpectedly.
8. **Economics:** use applicable customer pricing, actual venue tier and maker/taker outcomes. Separate venue expense, customer charge and retained Cinder revenue. Current public base-fee estimates do not establish production customer pricing.
9. **Confidentiality:** protect parent instructions and account records in the intended execution boundary. Native venue algorithms may reveal a parent amount to that venue; synthetic child orders may reduce that disclosure but do not establish unobservable activity. Keep that distinction explicit.
10. **Observability and recovery:** preserve parent/child identifiers, source timestamps, decisions, acknowledgements and reconciled outcomes. Give customers their own progress and receipts without exposing other customers or leaking confidential plans into ordinary logs.

For future routed strategies, choose explicitly between one venue for the whole parent and per-child routing. Per-child routing can create positions across multiple venues, needs available margin at each, and must be visible to the customer. It is not implicit permission to migrate existing positions. A reduce/close operation must reduce the relevant existing exposure rather than open an opposite position elsewhere.

## Analytical views

### Pro presentation

Standard and Pro are discoverable button-style choices rather than matching underline tabs. Standard stays neutral; Pro has a cobalt-accented resting state, routing icon and a solid cobalt selected state. Short captions explain “Choose venue” versus “Compare venues”. Native radio semantics, visible focus and a selected checkmark keep the choice unambiguous. This is a workspace choice, not a paid upgrade, execution authorization or new account mode; switching still preserves the separate drafts.

Standard and Pro reuse one instrument header: actual coin artwork, USDC pair and requested leverage. Pro keeps this header when switching between Execution cost and Price chart; the price chart's source remains independently selectable without repeating the market picker.

Quick sizes are one labelled USDC control with a selected state and directly update the existing order ticket. The buy/sell intent, notional exposure and shared reference are separate from these shortcuts. Feed health sits in the header; the cost plot and ranked venue table form one analytical workspace. Venue emblems identify the table rows, and fee provenance remains visible beside the expandable methodology.

The table shows **Price cost**, **Fee cost** and **Entry cost** in basis points of the same shared-reference order notional, with the total dollar cost secondary. Price cost includes the venue's price difference from the shared reference and the visible book sweep; it is not pure slippage against each venue's own midpoint. Fee cost is the actual estimated public taker fee divided by that common notional, not simply the published fee rate pasted beside another denominator. The two unrounded contributions sum to the plotted entry cost; rounding can introduce a 0.01 bp display difference. Eligible rows sort by full-precision cost (ascending), independently of buy/sell direction. Retained delayed quotes stay visibly unranked below them. The blue highlight still identifies a clear best estimate, not a near tie or a single remaining quote. Average fill and effective price remain available in the order-ticket breakdown and saved receipts; public fee provenance remains in the methodology. This presentation change does not modify the book walk, benchmark, fee policy, freshness gates or recommendation.

The cost plot defaults to an order-focused range, with **Full range** available for all captured depth. Both views use actual book-walk samples and stop at observed capacity. Chart range and curve visibility affect presentation only, not the ranked order, allowed venues, freshness checks or route-review validation. This is still entry cost versus USDC order size, not a cumulative price-versus-depth chart. No new historical collector or venue data service is introduced.

Retain **Cost versus size** as Pro's default. Consider **Cost history** next, using a fixed analysis size and direction independently of the current ticket. It describes historical estimates, not completed executions. Preserve missing intervals, alignment rules and fee provenance. The supplied handoff's recordings are not a live archive. Browser-session collection is possible without a data service; persistent shared history requires a separately authorized collector and storage design.

Keep **Visible depth** as a secondary view. Use consistent units and price reference, display each feed's coverage, and stop curves at observed levels. More returned levels do not establish a more liquid venue. Insufficient captured depth means the full-size estimate is unavailable, not that the venue has no more liquidity. Do not interpolate missing levels or rank a single complete estimate as proven cheapest across unavailable alternatives.

Do not extend the current immediate-entry cost metric unchanged to passive or scheduled strategies. Future execution depends on replenishment, queue position, price movement and maker/taker outcomes. Funding remains separate unless an explicit holding-period model is introduced.

### Live versus averaged comparison

Pro defaults to **Live** with an optional **5s average** beside it. Venue feeds keep their native cadence, while a bounded, browser-local analytical sampler observes accepted aligned books every 250ms. The graph, table, reference and row ordering are published as one frame once per second. Feed failures and expired book/fee validity still override that frame immediately; a smoother display must not imply stale observations are executable. Delayed badges no longer count tenths of a second in the main table; precise ages remain in feed diagnostics.

The averaged view uses a full five-second window of 20 possible clock slots and requires at least 16 matching valid slots (80% coverage). It averages computed price-cost, fee-cost and entry-cost contributions, not book levels. Every ranked venue uses exactly the same timestamps; at each timestamp the same selected venue cohort supplies the reference and USDC-to-base conversion. When a third venue lacks coverage, an adequately covered healthy pair may still be compared. An under-covered venue is labelled, not ranked. Missing samples are neither zero-filled nor backfilled after a suspended tab. Average curves stop at the minimum captured capacity across the shared samples, rather than averaging only periods that could fill a larger size.

Average rows sort by average entry cost and a clear winner is labelled **Lowest 5s average**. A near tie or lone estimate does not claim a cheapest venue. The separate ticket says **Best now · live estimate** and keeps recomputing from fresh feeds. Review performs a new live validation; historical means never select a destination or enter a saved route receipt. The average and live winners can legitimately differ. These are still public-book previews, not guarantees of production execution.

Market, side, size, allowed venue set, leverage, tolerance or account-state changes reset the window. Standard/Account navigation stops sampling and Pro feeds; returning collects a new window. Sampling preference is shareable through `analysis=average`, but entered amounts and customer activity are not put in the URL. This adds no backend collector, persistent history or changes to order submission.

Live is a labelled, once-per-second analytical snapshot, not an executable price. Current feed validity can remove eligibility before the next publication. A recovered venue is not restored to the old cohort until a new synchronized frame is published. Normal publication lag must not manufacture stale-feed warnings while current books remain healthy; if the analytical publisher itself stops refreshing, its frame also loses eligibility. Feed diagnostics describe current accepted observations, not the historical mean.

## Activity and order records

Keep Positions, Open orders, Trade history, Order history and Funding history. A strategy should have one parent record with expandable children rather than flooding the primary view with every slice. Show total target, filled and remaining quantity, average fill, actual charges, venue allocation and current state.

The top-level Activity timeline should explain important transitions: plan saved, parent accepted, paused, partially filled, cancelled or completed. In the demo, saved plans stay local and non-executing. Future pause/cancel actions must state whether resting orders remain and cannot reverse already completed fills.

## Acceptance checks

- Venue identity remains visible and is repeated in every Standard preview, including advanced strategies.
- Market/Limit/Advanced are prominent and keyboard accessible; only relevant inputs appear.
- Standard venue changes synchronize chart and book without silently changing intended exposure.
- Standard and Pro drafts remain independent; switching modes does not lose an advanced plan.
- Pro retains the existing analytical workspace and exposes permitted venues separately from its estimated destination.
- A trader can explain the difference between execution venue, customer margin and cross-venue offsets.
- No unknown risk model is presented as supported Cross or Isolated behaviour.
- Each strategy validates its parameters and explains its planned action without inventing execution outcomes.
- Preview/save actions perform no signing, venue writes, collateral movement or unattended execution.
- Existing live data, reduced-motion, mobile, accessibility and data-quality tests remain intact.

## Terminal chrome and connect-only wallet

- Standard execution uses a branded, keyboard-accessible venue list. Changing venue silently synchronizes the chart, book and record filter; it does not alter positions or the draft's intended size.
- The compact ticker shows the asset icon, USDC pair, requested leverage and venue emblem. Public-feed freshness remains available through a small status indicator and the existing feed details. The redundant workspace/execution/reference strip is removed.
- Header controls run left to right: Cinder account balance, Deposit, Withdraw, wallet. The balance remains illustrative Cinder account equity, not funds discovered in the connected wallet. Deposit and Withdraw retain their non-executing preview dialogs.
- Wallet discovery and connection use [Wallet Standard](https://github.com/wallet-standard/wallet-standard), with a custom Cinder picker rather than a wallet-adapter UI. This pass uses the small registry/features packages directly: it needs no RPC client or full transaction framework. Only `standard:connect`, `standard:events` and optional `standard:disconnect` are used. No signatures, sign-in, transactions, auto-connect or address persistence are enabled. Account changes, user rejection, wallet removal and cancellation of pending UI requests are handled.
- Market asset SVGs are vendored from the logo URLs in Phoenix's public SOL/BTC market metadata. Venue SVGs reuse the project's existing approved video asset set; the terminal does not hotlink the logos.

## References and unresolved signoff

Internal context: [product brief](../planned-product.md), [capability map](capability-map.md), [retail workflows](workflows-and-tests.md), [Pro research handoff](../Cinder_Pro_ImplementationHandoff.md) and [PMF and revenue model](../strategy/cinder-pmf-and-revenue-model.md). Earlier documents preserve historical decisions; this document governs the current local order-ticket iteration and its production requirements, not the backend's existing implementation.

The next backend handoff should confirm the customer margin boundary, per-venue execution capabilities, strategy ownership, authorization model, native versus synthetic reduce-only mapping, actual customer fees and lifecycle event contract. Exact algorithm parameters, all-venue strategy availability and cross-venue risk offsets remain unresolved. UI preview approval is not production execution approval.

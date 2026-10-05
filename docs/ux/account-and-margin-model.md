# Account clarity and margin preview

Updated 5 October 2026. This is the implemented **paper-demo contract**, not a claim about production collateral, cross margin or backend APIs. It complements `paper-trading-demo.md`.

## Financial figures

- **Cash balance:** the wallet-scoped paper ledger's settled balance. Starts at 10,000 simulated USDC, includes realized PnL and modeled venue fees already booked. Funding charges are not simulated.
- **Account equity:** cash plus unrealized PnL for every open position, valued at its execution venue's fresh published mark. This is an estimate, not a confirmed cash amount. Ticker-only subscriptions follow held SOL and BTC instruments independently of the chart, page and Standard/Pro selection. There is no entry-price fallback. If any required mark is unavailable, aggregate equity and aggregate unrealized PnL are unavailable; known cash and requirements remain visible.
- **Position margin requirements:** the paper engine's simplified entry-notional / requested-leverage requirements, netted within the same market and venue. These are not native maintenance or initial risk calculations. Read-only venue bars group these requirements; they exclude pending orders and their fees. They are neither editable capital allocations nor a promise of customer-level venue segregation or loss isolation.
- **Pending reservations:** collateral and conservative modeled fees held for unfilled orders and preview-only strategy plans. These remain distinct from filled-position requirements.
- **Available margin:** cash minus position requirements minus pending reservations, identically in the header's Account destination, Account, Standard and Pro. Unrealized gains are not spendable in this paper model. This is not notional buying power, withdrawable funds or a guarantee that a venue can execute immediately. No executable maximum is inferred from available margin multiplied by leverage.
- **Available to withdraw:** unavailable in the demo because simulated funds cannot be withdrawn. Do not invent a numeric withdrawal entitlement from available margin.

Account uses a compact overview and a collapsed Balance breakdown. Equity valuation and cash-based margin capacity are separate calculations, not a single misleading arithmetic waterfall. Activity and Agents retain their existing navigation locations.

## Inline order preview

The ticket retains venue/mode selection, Cross preview and requested leverage, order types and direction. Below direction it shows account-wide available margin and the current position for that market and execution venue. Pro's current-position row follows the recommended route; it does not net or move positions across venues. Position value is explicitly labeled USDC exposure.

For immediately fillable orders, the preview and the paper ledger share `paperFillImpact`:

1. Close the lesser of opposing order quantity and existing position quantity on the same market/venue.
2. Release proportional existing position margin for the closed quantity.
3. Add margin for the newly opening quantity at the estimated average fill / requested leverage.
4. Net additional margin = new requirement minus released requirement. Show positive additional margin separately from positive net margin release.
5. Show estimated venue fees separately. Available cash-based margin after a fill also reflects realized PnL and those fees.

Resting limits show **estimated margin reservation**, not a premature position-margin release. Non-reduce-only resting orders conservatively reserve requested notional / leverage plus modeled taker fees, even when they might later reduce a position. Reduce-only resting limits reserve fees. Preview-only advanced plans reserve their full margin and modeled fees; no child orders are generated. Marketable limits preview actual fill impact, while post-only crossings and unfillable IOC orders explain their outcomes.

Unavailable data, insufficient paper margin, slippage and reduce-only constraints appear contextually by the action. Inputs remain intact. No success banner, allocation workflow or mandatory review modal is introduced. Submission rechecks the fresh feed, depth, fees, bounds and actual account state; the preview does not guarantee execution.

Untouched limit inputs initialize once from the first fresh midpoint after connection. User-edited or deliberately cleared prices are never overwritten by market updates. Standard and Pro drafts are kept separately for each market during the visit and survive navigation/mode/market round trips. Draft contents are not written into URLs.

**Cross is explicitly a preview.** No cross-venue margin offsets, native venue collateral sharing or isolated customer venue accounts are implied. The production label must follow the backend's confirmed customer risk policy.

## Production backend contract to settle

These are required semantics, not existing endpoint names or implemented capabilities:

- Authoritative customer cash, equity, position marks, valuation freshness and completeness, realized/unrealized PnL, fees and funding accrual/payment treatment.
- Account-wide available margin, withdrawal eligibility, filled-position requirements and separate pending reservations under the actual customer risk policy. Confirm treatment of unrealized PnL, offsets, maintenance requirements and collateral haircuts before replacing the paper formula.
- Order-specific incremental margin impact, release, fees, reservation and risk eligibility. A reduction must not be previewed as a new opening order.
- Route-specific execution readiness and reasons, including actual venue collateral/capacity/limits and supported funding routes. A lowest-cost public-book estimate is not evidence of available venue collateral.
- When collateral funding is needed: source/destination, amount, authorized action, expected delay/cost if known, pending/failure/confirmed states and idempotency. Preserve the order inputs; refresh price, limits and eligibility after confirmed funding. Do not declare a transfer or trade completed before confirmation.
- Confirm whether Cinder provides a customer-level cross-risk account or a consolidated ledger with venue constraints. The UI cannot establish this financial policy by naming a control Cross.

Do not expose optional allocations until supported and authorized. Venue budgets, position requirements and native account compartments are different concepts; budgets must not imply loss isolation. No allocation commands or production funding/eligibility APIs are fabricated in this frontend pass.

The normal flow stays connect/deposit, choose a trade, read its compact inline preview, submit. Only a genuine execution constraint should surface operational funding detail.

Tests: `paper-account.spec.ts` covers complete/incomplete portfolio valuation and preview-to-ledger arithmetic; `account-clarity.spec.ts` covers shared figures, reservation exclusion, input preservation and expanded-breakdown accessibility at 375/768/1280px.

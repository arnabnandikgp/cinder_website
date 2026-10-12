# Venue balances and portfolio overview

Updated 12 October 2026. This supersedes the previous account-wide spending model. This is the implemented **paper-demo contract**, not a claim about production collateral, cross margin or backend APIs. It complements `paper-trading-demo.md`.

## Financial figures

- **Venue cash:** settled simulated USDC for one execution venue, including its realised PnL and booked fees. New wallets receive 5,000 on each of Pacifica, BULK and Phoenix: 15,000 portfolio cash. Velocity is preview-only and receives no credit. Funding charges are not simulated.
- **Demo wallet:** a separate finite 10,000 simulated USDC source for explicit top-ups. Excluded from portfolio equity and unavailable for trading until transferred to a venue. It is not the connected wallet’s actual balance.
- **Total equity:** sum of venue cash plus unrealized PnL for every open position, valued at its execution venue's fresh published mark. This is an estimate, not a confirmed cash amount. Ticker-only subscriptions follow held SOL and BTC instruments independently of the chart, page and Standard/Pro selection. There is no entry-price fallback. If any required mark is unavailable, aggregate equity and aggregate unrealized PnL are unavailable; known cash and requirements remain visible.
- **Position margin requirements:** the paper engine's simplified entry-notional / requested-leverage requirements, netted within the same market and venue. These are not native maintenance or initial risk calculations. Venue cards report requirements separately from pending reservations. Demo balance separation does not establish production customer segregation, liquidation policy or loss isolation.
- **Pending reservations:** collateral and conservative modeled fees held for unfilled orders and preview-only strategy plans. These remain distinct from filled-position requirements.
- **Available venue margin:** venue cash minus that venue’s position requirements and pending reservations. Standard uses its selected venue. Pro uses the execution venue shown on its ticket. Aggregate available margin is only a reporting sum, not a shared spendable balance. Unrealized gains are not spendable in this paper model. This is not notional buying power, withdrawable funds or a guarantee that a venue can execute immediately. No executable maximum is inferred from available margin multiplied by leverage.
- **Available to withdraw:** unavailable in the demo because simulated funds cannot be withdrawn. Do not invent a numeric withdrawal entitlement from available margin.

Account uses compact aggregate totals and horizontal venue cards showing available venue margin, equity, PnL, position count and requirements. Selecting a card filters the records below; All venues clears it. Trading and Account record filters are independent. A collapsed Balance breakdown separates portfolio valuation from requirements. Equity valuation and cash-based margin capacity are separate calculations, not a single misleading arithmetic waterfall. Activity and Agents retain their existing navigation locations.

## Inline order preview

The ticket retains venue/mode selection, a static **Cross** label and requested leverage, order types and direction. Cross is not clickable and has no information button. Below direction it shows available margin for the selected execution venue and the current position for that market and execution venue. Pro's current-position row follows the recommended route; it does not net or move positions across venues. Position value is explicitly labeled USDC exposure.

For immediately fillable orders, the preview and the paper ledger share `paperFillImpact`:

1. Close the lesser of opposing order quantity and existing position quantity on the same market/venue.
2. Release proportional existing position margin for the closed quantity.
3. Add margin for the newly opening quantity at the estimated average fill / requested leverage.
4. Net additional margin = new requirement minus released requirement. Show positive additional margin separately from positive net margin release.
5. Show estimated venue fees separately. Available cash-based margin after a fill also reflects realized PnL and those fees.

Resting limits show **estimated margin reservation**, not a premature position-margin release. Non-reduce-only resting orders conservatively reserve requested notional / leverage plus modeled taker fees, even when they might later reduce a position. Reduce-only resting limits reserve fees. Preview-only advanced plans reserve their full margin and modeled fees; no child orders are generated. Marketable limits preview actual fill impact, while post-only crossings and unfillable IOC orders explain their outcomes.

Unavailable data, insufficient paper margin, slippage and reduce-only constraints appear contextually by the action. Inputs remain intact. No success banner or mandatory trade-review modal is introduced. A funding-only shortfall changes the action to Top up [venue], preserving editable inputs. Submission rechecks the fresh feed, depth, fees, bounds and actual account state; the preview does not guarantee execution.

Untouched limit inputs initialize once from the first fresh midpoint after connection. User-edited or deliberately cleared prices are never overwritten by market updates. Standard and Pro drafts are kept separately for each market during the visit and survive navigation/mode/market round trips. Draft contents are not written into URLs.

**The Cross label does not change the venue-scoped simulation.** No cross-venue offsets, native collateral sharing or isolated liquidation is implied. It is not evidence of an implemented production cross-risk policy.

## Explicit demo funding and persistence

Top up opens an accessible drawer showing source, destination, safely available maximum and before/after balances. Return funds moves free venue cash back to the demo wallet; it cannot remove position requirements or order reservations. A short local pending state precedes confirmation. Closing during pending cancels it. Inputs survive errors and funding; confirmation never auto-submits a trade. Revalidate the newest book, fees, bounds and eligibility at submission.

Pro retains all comparable venues in public cost order but recommends the lowest-cost eligible funded route. A cheaper unfunded venue stays visible with Top-up required and an explicit funding action. If none is ready, the cheapest target stays visible with a funding action, not an executable promise. Mode changes never move funds.

Fees, realised PnL and reservations stay with the execution venue. Margin committed/released are order events, not fictional vault transfers. Explicit top-ups/returns and initial demo credits are transfer events. No signature, real wallet balance, PDA address, escrow transaction or production funding API is fabricated.

Version 2 persists under `cinder:paper:v2:<wallet>`. Valid v1 accounts retain exact total cash, positions, orders, fills and events: assign existing requirements/reservations to their venues and split remaining cash across the three supported venues, with a rounding correction. Preserve any deficits. Migrated accounts get no extra venue credit and no demo-wallet credit. Show a migration notice/audit event and retain the original v1 storage key as a backup. V2 reloads do not migrate or credit again. Reset paper account confirms before replacing only this wallet’s simulation. Browser storage remains user-editable and best-effort, with a warned memory fallback on failure.

## Production backend contract to settle

These are required semantics, not existing endpoint names or implemented capabilities:

- Authoritative customer cash, equity, position marks, valuation freshness and completeness, realized/unrealized PnL, fees and funding accrual/payment treatment.
- Per-customer venue escrow entitlements, available venue margin and return eligibility, filled-position requirements and separate pending reservations under the actual customer risk policy. Confirm treatment of unrealized PnL, offsets, maintenance requirements and collateral haircuts before replacing the paper formula.
- Order-specific incremental margin impact, release, fees, reservation and risk eligibility. A reduction must not be previewed as a new opening order.
- Route-specific execution readiness and reasons, including actual venue collateral/capacity/limits and supported funding routes. A lowest-cost public-book estimate is not evidence of available venue collateral.
- When collateral funding is needed: source/destination, amount, authorized action, expected delay/cost if known, pending/failure/confirmed states and idempotency. Preserve the order inputs; refresh price, limits and eligibility after confirmed funding. Do not declare a transfer or trade completed before confirmation.
- Confirm whether Cinder provides a customer-level cross-risk account or a consolidated ledger with venue constraints. The UI cannot establish this financial policy by naming a control Cross.

Do not expose production allocations until supported and authorized. Venue budgets, position requirements and native account compartments are different concepts; budgets must not imply loss isolation. No allocation commands or production funding/eligibility APIs are fabricated in this frontend pass.

The normal flow stays connect/deposit, choose a trade, read its compact inline preview, submit. Only a genuine execution constraint should surface operational funding detail.

Tests: `paper-account.spec.ts`, `venue-balances.spec.ts`, `account-clarity.spec.ts`, `paper-trading.spec.ts` and `account-workspace.spec.ts` cover local funding, conservation, migration, eligibility, record filters, persistence and responsive accessibility.

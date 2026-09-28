# Cinder trader review

Use the revised homepage and `/demo` for a short, moderated review with active retail perp traders. Chart-first is the only public layout. This is a qualitative pilot, not evidence that the UX or product economics have been validated.

## Before sharing

- Review the local homepage and demo with the founder, then deploy an approved preview or production update separately.
- Explain that prices, venues, balances and activity are fictional examples. No funds, wallet connection or transactions are needed.
- Ask permission before recording. Do not collect wallet secrets, personal account screenshots or trading balances.
- Use desktop first if that is how the participant normally trades; include mobile review with traders who actually use it.

## A 25-minute session

1. **First impression, 3 minutes.** Show the homepage without explaining Cinder. Ask: “What do you think this product does? What would you expect after opening the demo?” Note if they mistake it for a venue, a swaps aggregator or a live terminal.
2. **Manual trade, 6 minutes.** Ask them to prepare, but not submit, a 2 SOL limit buy at 151.50 on Pacifica. Have them explain the chart source, execution venue, size and review screen. Ask where they would find an existing position, a fill and a funding payment.
3. **Order lifecycle, 5 minutes.** Open `/demo?scenario=partial&record=orders`. Ask them to cancel the remainder and describe what is still open while confirmation is pending. Then load the sample confirmation. Ask whether the completed fill has disappeared.
4. **Account and Activity, 5 minutes.** Ask how much can be traded versus withdrawn, where a funding debit is recorded, and how they would investigate a pending deposit. Let them navigate between Account, Activity and the venue-scoped records without guidance.
5. **Future routing, 3 minutes.** Only now introduce Auto-route. Ask what they expect it to change, whether the chart still has a source, and whether it would move an existing position. Do not pitch the feature before hearing their interpretation.
6. **Close, 3 minutes.** Ask what feels missing, what they would distrust, and what task would make this worth returning to. Prefer a concrete recent trading workflow over a general “Would you use this?”

If a task is blocked, record it before helping. Avoid teaching participants the intended answer while measuring comprehension. Start with a small cohort, fix repeated misunderstandings, then test again; do not turn a handful of opinions into statistical claims.

## Record consistently

For each task, record: completed unaided / needed a hint / blocked; the participant's words; the specific control or label involved; and impact (cosmetic, confusing, task-blocking, or financially misleading). Separate observed behaviour from suggested features. Prioritise misunderstandings about venue scope, balances, order state and routing before visual preferences.

## Prototype boundaries

The demo uses TradingView Lightweight Charts for zoom, pan, crosshair and volume, with deterministic synthetic OHLC/depth and illustrative record excerpts, not a complete ledger or a Pacifica data feed. Review creates local drafts only. Leverage defaults to 25x and travels with the draft; it is not a verified venue maximum, margin computation or change to an existing position. Cancellation confirmation is a manually loaded sample state. Position reduction previews arithmetic without changing exposure. Funding actions do not produce an address or transaction. Margin, fee estimates, liquidation, TP/SL and real routing are not implemented. No live integration, savings, security or recovery guarantee can be inferred from a successful interaction.

In Choose venue mode, the chart and order book follow the execution venue, with no separate chart selector. Auto-route allows an independent reference chart; returning to Choose venue re-syncs chart and execution. The record filter remains independently selectable. Activity is account-wide. Account's margin breakdown uses the same fixture positions as the records: one SOL position on Pacifica (800 USDC), one BTC position on BULK (1,800 USDC), and none on Velocity. The 2,600 USDC total is an illustrative allocation, not a calculated margin requirement. Empty accounts show zero throughout.

Drafts are held in memory, while navigation context is reflected in the URL. Refresh discards drafts. The public review toolbar, reset and feedback buttons are removed. For moderated sessions, open `/demo?scenario=empty`, `/demo?scenario=stale`, or `/demo?scenario=deposit&view=account` directly; navigating to these URLs starts a fresh sample session. On small screens the order book is omitted, the chart shows fewer candles and wide records scroll horizontally.

## Visual direction applied

The frontend-design and design-taste guidance informed restrained cobalt accents, clearer controls, visible keyboard focus and state distinctions. The craft layer draws on Emil Kowalski's interaction principles.

| Earlier study            | Review prototype                                                         |
| ------------------------ | ------------------------------------------------------------------------ |
| Three competing layouts  | One chart-first entry point with Account and Activity alongside it       |
| Structural frames        | Cinder typography, tabular numbers, quiet panels and consistent controls |
| Happy-path exploration   | Draft validation, partial/cancel states, empty and stale scenarios       |
| Separate website imagery | Homepage screenshot captured from the actual `/demo` route               |

The design is ready to discuss, not fixed by validation. Resolve backend terminology and supported capabilities before converting this prototype into a live terminal.

## Terminal refinement

| Before                                    | After                                                                                              |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Hand-drawn static candles                 | TradingView's chart renderer with pan, zoom, crosshair and keyboard controls                       |
| Gray/cobalt trading direction             | Green bids/buys and red asks/sells against cool dark surfaces                                      |
| Inverted ask depth bars                   | Per-level sizes with totals accumulating away from the spread                                      |
| No leverage context                       | 25x default preference in the ticker, ticket and draft review                                      |
| Repeated sample labels inside every panel | Prototype boundaries in the homepage FAQ and action dialogs; no extra footer beneath the workspace |

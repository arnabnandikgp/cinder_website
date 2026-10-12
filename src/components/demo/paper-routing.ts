import { venues, type Draft, type Venue } from "./data";
import {
  paperTotals,
  previewPaperOrder,
  type PaperAccount,
} from "./paper-account";
import type { FeedState } from "./market-data/feed";
import type { RouteComparison } from "./routing";

export type VenueFunding = {
  available: number;
  shortfall: number;
  ready: boolean;
  reason: string | null;
};
export type PaperRoute = {
  comparison: RouteComparison;
  funding: Partial<Record<Venue, VenueFunding>>;
  cheapestUnfunded: Venue | null;
};

// Keep public cost analysis independent of balances. Only the order ticket's
// route is constrained here, with the same incremental-margin model as fills.
export function selectPaperRoute(
  account: PaperAccount | null,
  comparison: RouteComparison,
  feeds: Partial<Record<Venue, FeedState>>,
  now = Date.now(),
  reduceOnly = false,
): PaperRoute {
  const funding: PaperRoute["funding"] = {};
  if (!account) return { comparison, funding, cheapestUnfunded: null };
  for (const quote of comparison.ranked) {
    const feed = feeds[quote.venue];
    const draft: Draft = {
      id: "",
      market: comparison.input.market,
      mode: "auto",
      venue: quote.venue,
      allowed: comparison.input.allowed,
      side: comparison.input.side,
      type: "Market",
      size: String(comparison.input.notional ?? quote.notional),
      sizeUnit: "USDC",
      limit: "",
      leverage: String(comparison.input.leverage),
      slippage: String(comparison.input.slippage),
      reduceOnly,
    };
    const preview = feed
      ? previewPaperOrder(
          account,
          draft,
          feed,
          now,
          quote.reference,
          quote.quantity,
        )
      : null;
    funding[quote.venue] = {
      available: paperTotals(account, quote.venue).available,
      shortfall: preview?.fundingRequired ? preview.shortfall : 0,
      ready: Boolean(preview && !preview.reason),
      reason: preview
        ? preview.reason
        : "Waiting for a fresh book and fee estimate.",
    };
  }
  const ordered = comparison.best
    ? [
        comparison.best,
        ...comparison.ranked.filter((q) => q.venue !== comparison.best!.venue),
      ]
    : comparison.ranked;
  const eligible = ordered.find((q) => funding[q.venue]?.ready);
  // When none is ready, keep the cheapest target visible for an explicit top-up.
  const best = eligible ?? comparison.best;
  const changed = best?.venue !== comparison.best?.venue;
  const cheapestUnfunded =
    comparison.best &&
    changed &&
    (funding[comparison.best.venue]?.shortfall ?? 0) > 0
      ? comparison.best.venue
      : null;
  return {
    funding,
    cheapestUnfunded,
    comparison: {
      ...comparison,
      best,
      savings: changed ? null : comparison.savings,
      explanation: eligible
        ? `Lowest-cost eligible route using the existing ${venues[eligible.venue]} balance. No collateral is moved between venues.`
        : best
          ? (funding[best.venue]?.reason ?? comparison.explanation)
          : comparison.explanation,
    },
  };
}

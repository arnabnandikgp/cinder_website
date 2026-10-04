import { venues } from "./data";
import type { RouteComparison } from "./routing";

// Explain the current, eligible quote components. Do not infer book quality
// from venue names, averaged analysis, or a fee schedule on its own.
export function explainRoute(comparison: RouteComparison) {
  const { best, ranked, reference } = comparison;
  if (!best)
    return {
      text: "No complete eligible estimate to recommend.",
      against: null,
    };
  if (comparison.live?.tied)
    return {
      text: "Costs are similar; there is no clear cost advantage.",
      against: null,
    };
  const next = ranked.find((quote) => quote.venue !== best.venue);
  if (!next)
    return {
      text: "Only one complete estimate is available, so this is not a cheapest-venue comparison.",
      against: null,
    };
  const price = next.priceCost - best.priceCost;
  const fee = next.totalFees - best.totalFees;
  if (![price, fee, reference, best.quantity].every(Number.isFinite))
    return { text: "Lowest eligible estimated entry cost.", against: null };
  // Ignore differences below the display resolution or 0.01 bps of notional.
  const epsilon = Math.max(0.005, (best.quantity * reference * 0.01) / 10_000);
  const p = price > epsilon ? 1 : price < -epsilon ? -1 : 0;
  const f = fee > epsilon ? 1 : fee < -epsilon ? -1 : 0;
  const reason =
    p > 0 && f < 0
      ? "A better fill price outweighs the higher fee"
      : p < 0 && f > 0
        ? "Lower fees outweigh the higher price cost"
        : p > 0 && f > 0
          ? "A better fill price and lower fees"
          : p > 0
            ? "A better fill price at similar fees"
            : f > 0
              ? "Lower fees at a similar price cost"
              : "Lower total estimated entry cost";
  return {
    text: `${reason} versus ${venues[next.venue]}.`,
    against: {
      venue: next.venue,
      priceAdvantage: price,
      feeAdvantage: fee,
      saving: price + fee,
    },
  };
}

import { venues } from "./data";
import type { RouteComparison } from "./routing";

// Explain the current, eligible quote components. Do not infer book quality
// from venue names, averaged analysis, or a fee schedule on its own.
export function explainRoute(comparison: RouteComparison) {
  const { best, ranked } = comparison;
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
  const basis = best.quantity * best.reference;
  const nextBasis = next.quantity * next.reference;
  const price = (next.priceCost / nextBasis - best.priceCost / basis) * basis;
  const fee = (next.totalFees / nextBasis - best.totalFees / basis) * basis;
  if (
    ![price, fee, basis, nextBasis].every(Number.isFinite) ||
    basis <= 0 ||
    nextBasis <= 0
  )
    return {
      text: "Lowest eligible venue-local execution cost.",
      against: null,
    };
  // Ignore differences below the display resolution or 0.01 bps of notional.
  const epsilon = Math.max(0.005, (basis * 0.01) / 10_000);
  const p = price > epsilon ? 1 : price < -epsilon ? -1 : 0;
  const f = fee > epsilon ? 1 : fee < -epsilon ? -1 : 0;
  const reason =
    p > 0 && f < 0
      ? "Less spread and depth impact outweighs the higher fee"
      : p < 0 && f > 0
        ? "Lower fees outweigh the higher spread and depth impact"
        : p > 0 && f > 0
          ? "Less spread and depth impact and lower fees"
          : p > 0
            ? "Less spread and depth impact at similar fees"
            : f > 0
              ? "Lower fees at similar spread and depth impact"
              : "Lower venue-local execution cost";
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

import type { Candidate, Quote } from "./routing";

// Rank only actionable estimates. A retained, delayed observation must never
// outrank a fresh venue, even when its last observed cost looks cheaper.
export function orderVenueEstimates(candidates: readonly Candidate[]) {
  const eligible = (candidate: Candidate) =>
    !candidate.reason &&
    candidate.quote !== null &&
    Number.isFinite(candidate.quote.costBps);
  return [...candidates].sort((a, b) => {
    const aEligible = eligible(a);
    const bEligible = eligible(b);
    if (aEligible !== bEligible) return aEligible ? -1 : 1;
    // Array.sort is stable: equal costs and unavailable rows retain venue order.
    return aEligible ? a.quote!.costBps - b.quote!.costBps : 0;
  });
}

export function entryCostBreakdown(quote: Quote, reference: number) {
  const referenceNotional = quote.quantity * reference;
  if (
    !Number.isFinite(referenceNotional) ||
    referenceNotional <= 0 ||
    ![quote.priceCost, quote.venueFee, quote.costBps].every(Number.isFinite)
  )
    return null;
  // Both contributions use the same denominator as the plotted entry cost.
  // A venue's published fee rate applies to fill notional, not this benchmark.
  return {
    priceBps: (quote.priceCost / referenceNotional) * 10_000,
    feeBps: (quote.venueFee / referenceNotional) * 10_000,
    totalBps: quote.costBps,
  };
}

export function formatCostBps(value: number) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value) < 0.005 ? 0 : value);
}

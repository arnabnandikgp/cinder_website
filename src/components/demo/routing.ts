import { markets, type Market, type Scenario, type Venue } from "./data";
import type { LiveComparisonMeta } from "./live-routing";

// Deliberately fictional pricing and liquidity. This module never contacts a
// venue, signs an instruction, or models production brokerage risk.
export const snapshotLabels = {
  balanced: "Balanced liquidity",
  thin: "Thinner Pacifica book",
  stale: "BULK feed paused",
  unavailable: "Velocity unavailable",
} as const;
export type Snapshot = keyof typeof snapshotLabels;
export type Side = "Buy" | "Sell";
// Legacy synthetic scenarios never fabricate Phoenix pricing or liquidity.
export const venueKeys = ["pacifica", "bulk", "velocity"] as const;
export const CINDER_FEE_BPS = 0.6;
export const SNAPSHOT_TIME = "12:00:00 UTC";
export const MAX_CHART_NOTIONAL = 150_000;

const fixtures: Partial<
  Record<Venue, { fee: number; depth: number[]; buy: number[]; sell: number[] }>
> = {
  pacifica: {
    fee: 2.8,
    depth: [2500, 7500, 15000, 25000, 40000, 65000, 100000],
    buy: [0.6, 1.1, 2.5, 5.5, 11, 21, 38],
    sell: [0.9, 1.5, 3.2, 6.5, 12, 23, 40],
  },
  bulk: {
    fee: 2.4,
    depth: [7500, 17500, 50000, 100000, 100000, 150000, 200000],
    buy: [1.8, 2, 2.4, 3.1, 4.5, 6, 9],
    sell: [1.1, 1.4, 1.8, 2.5, 3.5, 5, 8],
  },
  velocity: {
    fee: 0.8,
    depth: [1000, 2000, 3000, 5000, 9000, 10000, 20000],
    buy: [2, 4, 7, 10, 15, 22, 32],
    sell: [2.5, 5, 8, 12, 17, 24, 35],
  },
};

export type Quote = {
  venue: Venue;
  quantity: number;
  averageFill: number;
  worstFill: number;
  notional: number;
  venueFee: number;
  cinderFee: number;
  totalFees: number;
  priceCost: number;
  totalCost: number;
  costBps: number;
  effectivePrice: number;
};
export type Candidate = {
  venue: Venue;
  quote: Quote | null;
  reason: string | null;
};
export type RouteInput = {
  market: Market;
  side: Side;
  quantity: number;
  // Optional USDC intent; live comparison converts once at its shared reference.
  notional?: number;
  leverage: number;
  slippage: number;
  allowed: Venue[];
  snapshot: Snapshot;
  account: Scenario;
};
export type RouteComparison = {
  input: RouteInput;
  reference: number;
  candidates: Candidate[];
  ranked: Quote[];
  best: Quote | null;
  savings: number | null;
  explanation: string;
  live?: LiveComparisonMeta;
};
export type RouteReceipt = RouteComparison & { savedAt: string };

export function feedIssue(venue: Venue, snapshot: Snapshot) {
  if (snapshot === "stale" && venue === "bulk")
    return "Feed paused · quote excluded";
  if (snapshot === "unavailable" && venue === "velocity")
    return "Venue unavailable";
  return null;
}

export function fixtureBook(
  market: Market,
  venue: Venue,
  side: Side,
  snapshot: Snapshot,
) {
  const reference = markets[market].price;
  const fixture = fixtures[venue];
  if (!fixture) return [];
  const direction = side === "Buy" ? 1 : -1;
  const offsets = side === "Buy" ? fixture.buy : fixture.sell;
  return fixture.depth.map((depth, index) => ({
    price: reference * (1 + (direction * offsets[index]) / 10_000),
    quantity:
      (depth * (snapshot === "thin" && venue === "pacifica" ? 0.12 : 1)) /
      reference,
  }));
}

export function quoteVenue(
  market: Market,
  venue: Venue,
  side: Side,
  quantity: number,
  snapshot: Snapshot,
): Quote | null {
  const fixture = fixtures[venue];
  if (!fixture) return null;
  if (!Number.isFinite(quantity) || quantity <= 0 || feedIssue(venue, snapshot))
    return null;
  let remaining = quantity;
  let notional = 0;
  let worstFill = 0;
  for (const level of fixtureBook(market, venue, side, snapshot)) {
    const filled = Math.min(remaining, level.quantity);
    notional += filled * level.price;
    remaining -= filled;
    worstFill = level.price;
    if (remaining <= quantity * 1e-12) break;
  }
  // Never compare a partial-size quote to another venue's complete-size quote.
  if (remaining > quantity * 1e-12) return null;
  const averageFill = notional / quantity;
  const venueFee = (notional * fixture.fee) / 10_000;
  const cinderFee = (notional * CINDER_FEE_BPS) / 10_000;
  const totalFees = venueFee + cinderFee;
  const direction = side === "Buy" ? 1 : -1;
  const priceCost =
    direction * quantity * (averageFill - markets[market].price);
  const totalCost = priceCost + totalFees;
  return {
    venue,
    quantity,
    averageFill,
    worstFill,
    notional,
    venueFee,
    cinderFee,
    totalFees,
    priceCost,
    totalCost,
    costBps: (totalCost / (quantity * markets[market].price)) * 10_000,
    effectivePrice: averageFill + (direction * totalFees) / quantity,
  };
}

export function compareRoutes(input: RouteInput): RouteComparison {
  const reference = markets[input.market].price;
  const validSize = Number.isFinite(input.quantity) && input.quantity > 0;
  const validSlippage =
    Number.isFinite(input.slippage) &&
    input.slippage > 0 &&
    input.slippage < 100;
  const validLeverage = [1, 2, 5, 10, 25].includes(input.leverage);
  const candidates = venueKeys.map((venue): Candidate => {
    const quote = quoteVenue(
      input.market,
      venue,
      input.side,
      input.quantity,
      input.snapshot,
    );
    let reason: string | null = null;
    if (!input.allowed.includes(venue)) reason = "Excluded in preferences";
    else if (!validSize) reason = "Enter a valid order size";
    else if (feedIssue(venue, input.snapshot))
      reason = feedIssue(venue, input.snapshot);
    else if (input.account === "stale") reason = "Account updates paused";
    else if (input.account === "empty") reason = "No available collateral";
    else if (!quote) reason = "Insufficient depth for full order";
    else if (!validLeverage) reason = "Select a supported leverage";
    else if (!validSlippage) reason = "Enter a valid slippage limit";
    else if (
      Math.abs(quote.worstFill / reference - 1) * 100 >
      input.slippage + 1e-10
    )
      reason = "Exceeds slippage limit";
    // A simple, explicit fixture budget, not Cinder's actual risk/margin model.
    else if (quote.notional / input.leverage + quote.totalFees > 7400)
      reason = "Exceeds sample margin budget";
    return { venue, quote, reason };
  });
  const ranked = candidates
    .filter((c) => c.quote && !c.reason)
    .map((c) => c.quote!)
    .sort(
      (a, b) => a.totalCost - b.totalCost || a.venue.localeCompare(b.venue),
    );
  const best = ranked[0] ?? null;
  const runnerUp = ranked[1];
  const cheaperFee = best && ranked.some((q) => q.totalFees < best.totalFees);
  const savings =
    best && runnerUp ? Math.max(0, runnerUp.totalCost - best.totalCost) : null;
  const explanation = !best
    ? "No eligible route. Check size, slippage, collateral or venue preferences."
    : !runnerUp
      ? "The only eligible venue in this snapshot. No comparative saving is available."
      : savings !== null && savings < 0.01
        ? "Estimates are effectively tied at the displayed precision."
        : cheaperFee
          ? "A better fill outweighs a cheaper fee elsewhere at this size."
          : "The lowest combined fill cost and fees for this order size.";
  return { input, reference, candidates, ranked, best, savings, explanation };
}

export function parseAmount(value: string) {
  return /^\d+(\.\d+)?$/.test(value.trim()) && Number.isFinite(Number(value))
    ? Number(value)
    : NaN;
}

export function money(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (value !== 0 && Math.abs(value) < 0.01)
    return value < 0 ? "−<$0.01" : "<$0.01";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

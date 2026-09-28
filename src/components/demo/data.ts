// Synthetic, customer-scoped fixtures only. No venue API, fee schedule, or risk model.
export const venues = {
  pacifica: "Pacifica",
  bulk: "BULK",
  velocity: "Velocity",
} as const;
export type Venue = keyof typeof venues;
export type VenueScope = Venue | "all";
export const markets = {
  SOL: {
    name: "Solana",
    symbol: "SOL-PERP",
    price: 152,
    entry: 150,
    size: 8,
    side: "Long",
    pnl: 16,
    step: 0.01,
  },
  BTC: {
    name: "Bitcoin",
    symbol: "BTC-PERP",
    price: 61800,
    entry: 62000,
    size: 0.04,
    side: "Short",
    pnl: 8,
    step: 1,
  },
} as const;
export type Market = keyof typeof markets;
export const recordLabels = {
  positions: "Positions",
  orders: "Open orders",
  trades: "Trade history",
  history: "Order history",
  funding: "Funding history",
} as const;
export type RecordTab = keyof typeof recordLabels;
export type View = "trade" | "account" | "activity";
export type Scenario = "funded" | "partial" | "empty" | "stale" | "deposit";
export type CancelState = "none" | "requested" | "confirmed";
export type Draft = {
  id: string;
  market: Market;
  side: string;
  type: string;
  size: string;
  limit: string;
  slippage: string;
  leverage: string;
  mode: "manual" | "auto";
  venue: Venue;
  allowed: Venue[];
};
export type Fill = {
  id: string;
  order: string;
  venue: Venue;
  market: Market;
  side: string;
  size: number;
  price: number;
  fee: number | null;
  time: string;
};
export const pastFills: Fill[] = [
  {
    id: "FL-203",
    order: "EX-103",
    venue: "bulk",
    market: "SOL",
    side: "Sell",
    size: 1,
    price: 153,
    fee: 0.04,
    time: "11:50:00",
  },
  {
    id: "FL-202",
    order: "EX-102",
    venue: "pacifica",
    market: "SOL",
    side: "Buy",
    size: 0.75,
    price: 151.5,
    fee: 0.03,
    time: "11:45:02",
  },
  {
    id: "FL-201",
    order: "EX-102",
    venue: "pacifica",
    market: "SOL",
    side: "Buy",
    size: 1.25,
    price: 151.25,
    fee: 0.05,
    time: "11:45:00",
  },
];
export const funding = [
  {
    id: "FU-302",
    venue: "pacifica" as Venue,
    market: "SOL" as Market,
    amount: -0.36,
    time: "11:00:00",
  },
  {
    id: "FU-301",
    venue: "bulk" as Venue,
    market: "BTC" as Market,
    amount: 0.12,
    time: "10:00:00",
  },
];
export function fillsFor(scenario: Scenario): Fill[] {
  if (scenario === "empty") return [];
  return scenario === "partial"
    ? [
        {
          id: "FL-204",
          order: "EX-104",
          venue: "pacifica",
          market: "SOL",
          side: "Buy",
          size: 2,
          price: 151.5,
          fee: null,
          time: "11:58:00",
        },
        ...pastFills,
      ]
    : pastFills;
}
export function number(value: number, decimals = 2) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
export function signed(value: number) {
  return `${value >= 0 ? "+" : "−"}${number(Math.abs(value))}`;
}
export function pick<T extends string>(
  value: string | null,
  choices: readonly T[],
  fallback: T,
): T {
  return choices.includes(value as T) ? (value as T) : fallback;
}
export function referencePrice(market: Market, venue: Venue) {
  const offset =
    venue === "bulk"
      ? market === "SOL"
        ? 0.05
        : 4
      : venue === "velocity"
        ? market === "SOL"
          ? -0.02
          : -3
        : 0;
  return markets[market].price + offset;
}

// Per-level size may vary. Depth bars encode cumulative size from the spread,
// so both sides grow outward, not toward the midpoint. No executable quotes.
export function orderBook(market: Market, venue: Venue) {
  const mid = referencePrice(market, venue);
  const scale = market === "SOL" ? 1 : 0.001;
  const makeSide = (sizes: number[], direction: number) => {
    let total = 0;
    return sizes.map((size, index) => {
      const quantity = Number((size * scale).toFixed(3));
      total = Number((total + quantity).toFixed(3));
      return {
        price: Number(
          (mid + direction * markets[market].step * (index + 1)).toFixed(2),
        ),
        size: quantity,
        total,
      };
    });
  };
  const asks = makeSide([18.4, 32.8, 12.6, 74.2, 21.5, 54.8, 96.3, 37.6], 1);
  const bids = makeSide([24.6, 41.2, 16.8, 68.4, 33.7, 82.5, 49.1, 113.8], -1);
  return {
    asks: asks.reverse(),
    bids,
    max: Math.max(asks[0].total, bids[bids.length - 1].total),
  };
}
export function candles(market: Market, venue: Venue, interval: string) {
  // Quantize generated fixtures so libm differences between Node and browsers
  // cannot leak floating-point noise into server-rendered SVG attributes.
  const stable = (value: number) => Number(value.toFixed(6));
  const end = referencePrice(market, venue);
  const unit = market === "SOL" ? 1 : 240;
  const factor = interval === "1h" ? 1.4 : interval === "4h" ? 2.2 : 1;
  const raw = Array.from(
    { length: 68 },
    (_, i) => 0.042 * i + Math.sin(i * 0.32) * 0.6 + Math.sin(i * 1.7) * 0.19,
  );
  return raw.map((v, i) => {
    const close = end + (v - raw[raw.length - 1]) * unit * factor;
    const open =
      end + ((i ? raw[i - 1] : v - 0.12) - raw[raw.length - 1]) * unit * factor;
    return {
      open: stable(open),
      close: stable(close),
      high: stable(
        Math.max(open, close) +
          (0.12 + Math.abs(Math.sin(i)) * 0.14) * unit * factor,
      ),
      low: stable(Math.min(open, close) - 0.17 * unit * factor),
      volume: stable(15 + Math.abs(Math.sin(i * 1.3)) * 55),
    };
  });
}

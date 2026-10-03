import type { Market, Venue } from "../data";

export const intervals = {
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
} as const;
export type Interval = keyof typeof intervals;
export type LiveVenue = Exclude<Venue, "velocity">;
export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  partial?: boolean;
};
export type Level = { price: number; size: number };
export type Book = {
  bids: Level[];
  asks: Level[];
  time: number;
  sourceTime?: string;
};
export type Ticker = {
  mark: number;
  oracle?: number;
  // Decimal fractions, not percentages. Never infer a funding period from
  // the payment schedule: BULK's rate quotation period is not yet verified.
  funding?: number;
  nextFunding?: number;
  mid?: number;
  last?: number;
  change?: number;
  volume?: number;
  time: number;
};
export type MarketInfo = { tick: number; lot: number; maxLeverage: number };
export type Trade = { price: number; size: number; time: number };

export const endpoints = {
  pacifica: {
    rest: "https://api.pacifica.fi/api/v1",
    ws: "wss://ws.pacifica.fi/ws",
  },
  bulk: {
    rest: "https://mainnet-api1.bulk.trade/api/v1",
    ws: "wss://mainnet-ws1.bulk.trade",
  },
} as const;

export function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function numeric(value: unknown): number {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim()))
    return NaN;
  const result = Number(value);
  return Number.isFinite(result) ? result : NaN;
}
export function positive(value: unknown): number {
  const n = numeric(value);
  return n > 0 ? n : NaN;
}

// BULK ticker/book timestamps are nanoseconds in observed mainnet payloads,
// despite the book schema saying milliseconds. Never use a rounded ns Number
// as an event sequence ID. UI freshness needs only millisecond precision.
export function milliseconds(value: unknown): number {
  if (typeof value === "string" && /^\d{16,20}$/.test(value)) {
    const raw = BigInt(value);
    return milliseconds(
      Number(
        raw >= BigInt("100000000000000000")
          ? raw / BigInt(1000000)
          : raw / BigInt(1000),
      ),
    );
  }
  const n = positive(value);
  const ms =
    n >= 1e17 ? n / 1e6 : n >= 1e14 ? n / 1e3 : n >= 1e11 ? n : n * 1000;
  return Number.isFinite(ms) &&
    ms >= Date.UTC(2020, 0, 1) &&
    ms <= Date.UTC(2100, 0, 1)
    ? Math.floor(ms)
    : NaN;
}
export function symbol(venue: LiveVenue, market: Market) {
  return venue === "bulk" ? `${market}-USD` : market;
}
export function precision(tick: number) {
  return (tick.toFixed(8).replace(/0+$/, "").split(".")[1] ?? "").length;
}

export function historyUrl(
  venue: LiveVenue,
  market: Market,
  interval: Interval,
  end = Date.now(),
  count = 500,
) {
  const params = new URLSearchParams({
    symbol: symbol(venue, market),
    interval,
  });
  params.set(
    venue === "pacifica" ? "start_time" : "startTime",
    String(end - intervals[interval] * 1000 * count),
  );
  params.set(venue === "pacifica" ? "end_time" : "endTime", String(end));
  if (venue === "pacifica") params.set("limit", String(count));
  return `${endpoints[venue].rest}/${venue === "pacifica" ? "kline" : "klines"}?${params}`;
}
export function subscriptions(
  venue: LiveVenue,
  market: Market,
  interval: Interval,
  purpose: "chart" | "comparison" = "chart",
) {
  const s = symbol(venue, market);
  if (purpose === "comparison")
    return venue === "pacifica"
      ? [
          {
            method: "subscribe",
            params: { source: "book", symbol: s, agg_level: 1 },
          },
        ]
      : [
          {
            method: "subscribe",
            subscription: [{ type: "l2Snapshot", symbol: s, nlevels: 1000 }],
          },
        ];
  return venue === "pacifica"
    ? [
        {
          method: "subscribe",
          params: { source: "book", symbol: s, agg_level: 1 },
        },
        { method: "subscribe", params: { source: "prices" } },
        {
          method: "subscribe",
          params: { source: "candle", symbol: s, interval },
        },
      ]
    : [
        {
          method: "subscribe",
          subscription: [
            { type: "l2Snapshot", symbol: s, nlevels: 20 },
            { type: "ticker", symbol: s },
            { type: "candle", symbol: s, interval },
            { type: "trades", symbol: s },
          ],
        },
      ];
}

export function parseCandles(
  value: unknown,
  interval: Interval,
  now = Date.now(),
): Candle[] {
  if (!Array.isArray(value)) return [];
  const result = new Map<number, Candle>();
  for (const item of value) {
    const x = object(item);
    const stamp = milliseconds(x.t);
    const time = Math.floor(stamp / 1000);
    const [open, high, low, close, volume] = [
      positive(x.o),
      positive(x.h),
      positive(x.l),
      positive(x.c),
      numeric(x.v),
    ];
    if (
      ![time, open, high, low, close, volume].every(Number.isFinite) ||
      volume < 0 ||
      stamp % (intervals[interval] * 1000) !== 0 ||
      time * 1000 > now + 5000 ||
      high < Math.max(open, close) ||
      low > Math.min(open, close) ||
      low > high
    )
      continue;
    result.set(time, { time, open, high, low, close, volume });
  }
  return [...result.values()].sort((a, b) => a.time - b.time).slice(-1000);
}
export function parseBook(venue: LiveVenue, value: unknown): Book | null {
  const x = object(value);
  if (venue === "bulk" && x.updateType !== "snapshot") return null;
  const levels = venue === "pacifica" ? x.l : x.levels;
  const time = milliseconds(venue === "pacifica" ? x.t : x.timestamp);
  if (!Array.isArray(levels) || levels.length !== 2 || !Number.isFinite(time))
    return null;
  const sides: Level[][] = [];
  for (const side of levels) {
    if (!Array.isArray(side)) return null;
    const result = new Map<number, number>();
    let previous: number | undefined;
    for (const item of side) {
      const row = object(item);
      const price = positive(venue === "pacifica" ? row.p : row.px);
      const size = numeric(venue === "pacifica" ? row.a : row.sz);
      // Reject corrupt snapshots atomically; never expose a partially decoded book.
      if (
        !Number.isFinite(price) ||
        !Number.isFinite(size) ||
        size < 0 ||
        result.has(price)
      )
        return null;
      if (
        previous !== undefined &&
        (sides.length === 0 ? price >= previous : price <= previous)
      )
        return null;
      previous = price;
      if (size > 0) result.set(price, size);
    }
    sides.push([...result].map(([price, size]) => ({ price, size })));
  }
  const bids = sides[0];
  const asks = sides[1];
  if (bids.length && asks.length && bids[0].price >= asks[0].price) return null;
  return {
    bids,
    asks,
    time,
    sourceTime: String(venue === "pacifica" ? x.t : x.timestamp),
  };
}
export function parseTicker(venue: LiveVenue, value: unknown): Ticker | null {
  const x = object(value);
  const mark = positive(venue === "pacifica" ? x.mark : x.markPrice);
  const time = milliseconds(x.timestamp);
  if (!Number.isFinite(mark) || !Number.isFinite(time)) return null;
  const mid = positive(x.mid);
  const last = positive(x.lastPrice);
  const yesterday = positive(x.yesterday_price);
  const change =
    venue === "bulk"
      ? numeric(x.priceChangePercent)
      : (mid / yesterday - 1) * 100;
  const volume = numeric(venue === "bulk" ? x.quoteVolume : x.volume_24h);
  const oracle = positive(venue === "bulk" ? x.oraclePrice : x.oracle);
  const funding = numeric(venue === "bulk" ? x.fundingRate : x.funding);
  const nextFunding = venue === "pacifica" ? numeric(x.next_funding) : NaN;
  return {
    mark,
    time,
    ...(Number.isFinite(oracle) ? { oracle } : {}),
    ...(Number.isFinite(funding) ? { funding } : {}),
    ...(Number.isFinite(nextFunding) ? { nextFunding } : {}),
    ...(Number.isFinite(mid) ? { mid } : {}),
    ...(Number.isFinite(last) ? { last } : {}),
    ...(Number.isFinite(change) ? { change } : {}),
    ...(Number.isFinite(volume) && volume >= 0 ? { volume } : {}),
  };
}
export function parseInfo(
  venue: LiveVenue,
  value: unknown,
  market: Market,
): MarketInfo | null {
  const data = venue === "pacifica" ? object(value).data : value;
  if (!Array.isArray(data)) return null;
  const x = object(
    data.find((row) => object(row).symbol === symbol(venue, market)),
  );
  const tick = positive(venue === "pacifica" ? x.tick_size : x.tickSize);
  const lot = positive(venue === "pacifica" ? x.lot_size : x.lotSize);
  const maxLeverage = positive(
    venue === "pacifica" ? x.max_leverage : x.maxLeverage,
  );
  return [tick, lot, maxLeverage].every(Number.isFinite)
    ? { tick, lot, maxLeverage }
    : null;
}
export function parseTrades(
  value: unknown,
  market: Market,
  now = Date.now(),
): Trade[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      const x = object(item);
      const price = positive(x.px),
        size = positive(x.sz),
        time = milliseconds(x.time);
      return x.s === `${market}-USD` &&
        [price, size, time].every(Number.isFinite) &&
        time <= now + 5000
        ? [{ price, size, time }]
        : [];
    })
    .sort((a, b) => a.time - b.time);
}

export function mergeCandles(current: Candle[], incoming: Candle[]): Candle[] {
  const map = new Map(current.map((bar) => [bar.time, bar]));
  for (const bar of incoming) map.set(bar.time, bar);
  return [...map.values()].sort((a, b) => a.time - b.time).slice(-1000);
}

// A new socket cannot know the first candle's earlier trades. Mark it partial;
// don't manufacture OHLC/volume from a mark price or add volume to overlapping
// venue candles. Completed venue candles replace these observed-trade bars.
export class TradeCandles {
  private bars = new Map<number, Candle & { first: number; last: number }>();
  constructor(
    private interval: Interval,
    private connectedAt: number,
  ) {}
  add(trades: Trade[]) {
    for (const trade of trades) {
      if (trade.time < this.connectedAt) continue;
      const time =
        Math.floor(trade.time / (intervals[this.interval] * 1000)) *
        intervals[this.interval];
      const bar = this.bars.get(time);
      if (bar) {
        this.bars.set(time, {
          ...bar,
          high: Math.max(bar.high, trade.price),
          low: Math.min(bar.low, trade.price),
          open: trade.time < bar.first ? trade.price : bar.open,
          close: trade.time >= bar.last ? trade.price : bar.close,
          volume: bar.volume + trade.size,
          first: Math.min(bar.first, trade.time),
          last: Math.max(bar.last, trade.time),
        });
      } else {
        this.bars.set(time, {
          time,
          open: trade.price,
          high: trade.price,
          low: trade.price,
          close: trade.price,
          volume: trade.size,
          partial: time * 1000 < this.connectedAt,
          first: trade.time,
          last: trade.time,
        });
      }
    }
    while (this.bars.size > 1000)
      this.bars.delete(this.bars.keys().next().value!);
  }
  combine(canonical: Candle[], now: number): Candle[] {
    const canonicalTimes = new Set(canonical.map((bar) => bar.time));
    const currentTime =
      Math.floor(now / (intervals[this.interval] * 1000)) *
      intervals[this.interval];
    return mergeCandles(
      canonical,
      [...this.bars.values()].filter(
        (bar) => bar.time >= currentTime || !canonicalTimes.has(bar.time),
      ),
    );
  }
}

export function displayBook(book: Book, depth = 8, tick?: number) {
  function accumulate(levels: Level[], side: "bid" | "ask") {
    if (tick) {
      const buckets = new Map<number, number>();
      for (const row of levels) {
        // Group away from the spread, avoiding visually duplicated rounded
        // levels when a venue publishes sub-tick floating-point prices.
        const bucket =
          side === "bid"
            ? Math.floor(row.price / tick + 1e-7)
            : Math.ceil(row.price / tick - 1e-7);
        const price = Number((bucket * tick).toFixed(precision(tick)));
        buckets.set(price, (buckets.get(price) ?? 0) + row.size);
      }
      levels = [...buckets].map(([price, size]) => ({ price, size }));
    }
    let total = 0;
    return levels
      .slice(0, depth)
      .map((row) => ({ ...row, total: (total += row.size) }));
  }
  const bids = accumulate(book.bids, "bid"),
    asks = accumulate(book.asks, "ask").reverse();
  return {
    bids,
    asks,
    max: Math.max(bids.at(-1)?.total ?? 0, asks[0]?.total ?? 0, Number.EPSILON),
  };
}

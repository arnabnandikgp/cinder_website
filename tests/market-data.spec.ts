import { expect, test } from "@playwright/test";
import {
  milliseconds,
  parseCandles,
  parseBook,
  parseInfo,
  parseTrades,
  TradeCandles,
  mergeCandles,
  displayBook,
  historyUrl,
  precision,
  parseTicker,
} from "../src/components/demo/market-data/adapters";
import {
  fundingPercent,
  percent,
  volumeUsd,
} from "../src/components/demo/market-data/format";

test("tickers preserve signed funding fractions, oracle prices and USD volume for each venue", () => {
  const timestamp = Date.now();
  expect(
    parseTicker("pacifica", {
      mark: "152",
      oracle: "151.95",
      funding: "0",
      next_funding: "-0.0000215",
      volume_24h: "0",
      timestamp,
    }),
  ).toMatchObject({
    mark: 152,
    oracle: 151.95,
    funding: 0,
    nextFunding: -0.0000215,
    volume: 0,
  });
  const bulk = parseTicker("bulk", {
    markPrice: 153,
    oraclePrice: 152.9,
    fundingRate: 0.0001,
    quoteVolume: 234567890,
    volume: 123,
    timestamp: timestamp * 1e6,
  });
  expect(bulk).toMatchObject({
    oracle: 152.9,
    funding: 0.0001,
    volume: 234567890,
  });
  // Numeric nanosecond timestamps can lose a fraction of a millisecond in
  // JSON's floating-point representation; they are only used for UI freshness.
  expect(Math.abs(bulk!.time - timestamp)).toBeLessThanOrEqual(1);
  expect(
    parseTicker("bulk", { markPrice: 153, next_funding: 1, timestamp })
      ?.nextFunding,
  ).toBeUndefined();
});

test("invalid optional statistics do not become zero or replace valid mark prices", () => {
  for (const invalid of [null, undefined, "", false, "NaN", Infinity]) {
    const ticker = parseTicker("pacifica", {
      mark: "152",
      oracle: invalid,
      funding: invalid,
      next_funding: invalid,
      volume_24h: invalid,
      timestamp: Date.now(),
    });
    expect(ticker?.mark).toBe(152);
    for (const field of ["oracle", "funding", "nextFunding", "volume"])
      expect(ticker).not.toHaveProperty(field);
  }
  expect(
    parseTicker("pacifica", {
      mark: 152,
      oracle: 0,
      volume_24h: -1,
      timestamp: Date.now(),
    }),
  ).not.toHaveProperty("oracle");
});

test("market statistic formatting preserves tiny signed rates and distinguishes missing values from zero", () => {
  expect(fundingPercent(0.0000125)).toBe("+0.00125%");
  expect(fundingPercent(-0.0000215)).toBe("−0.00215%");
  expect(fundingPercent(0)).toBe("0.00%");
  expect(fundingPercent(-0)).toBe("0.00%");
  expect(fundingPercent(-1e-10)).toBe("−<0.00001%");
  expect(percent(-0.004)).toBe("−<0.01%");
  expect(volumeUsd(0)).toBe("$0.00");
  expect(volumeUsd(0.001)).toBe("<$0.01");
  expect(volumeUsd(12345678.9)).toBe("$12.3M");
  for (const value of [undefined, NaN, Infinity]) {
    expect(fundingPercent(value)).toBe("—");
    expect(volumeUsd(value)).toBe("—");
  }
});

test("timestamps normalize ms/us/ns without using nanoseconds as sequence IDs", () => {
  const ms = Date.UTC(2026, 9, 2, 12);
  for (const value of [
    ms,
    ms * 1000,
    ms * 1000000,
    String(ms * 1000000),
    ms / 1000,
  ])
    expect(milliseconds(value)).toBe(ms);
  for (const value of [null, "", false, {}, NaN, Infinity, -1, 1])
    expect(Number.isNaN(milliseconds(value))).toBe(true);
});
test("candle decoder sorts, deduplicates and rejects invalid OHLCV", () => {
  const t = Date.UTC(2026, 9, 2, 12),
    bar = { t, o: "100", h: "110", l: "90", c: "101", v: "2" };
  const candles = parseCandles(
    [
      { ...bar, t: t + 300000 },
      bar,
      { ...bar, c: 102 },
      { ...bar, t: t + 1 },
      { ...bar, l: 105 },
      { ...bar, v: -2 },
    ],
    "5m",
    t + 300000,
  );
  expect(candles).toHaveLength(2);
  expect(candles[0].close).toBe(102);
  expect(candles[0].time).toBe(t / 1000);
});
test("snapshots replace both sides atomically and reject corrupt or crossed books", () => {
  const book = {
    s: "SOL",
    t: Date.now(),
    l: [[{ p: "100", a: "1" }], [{ p: "101", a: "2" }]],
  };
  expect(parseBook("pacifica", book)?.bids[0]).toEqual({ price: 100, size: 1 });
  expect(
    parseBook("pacifica", { ...book, l: [book.l[0], [{ p: 99, a: 1 }]] }),
  ).toBeNull();
  expect(
    parseBook("pacifica", { ...book, l: [book.l[0], [{ p: 101, a: "bad" }]] }),
  ).toBeNull();
  expect(
    parseBook("bulk", {
      updateType: "delta",
      levels: [[], []],
      timestamp: Date.now(),
    }),
  ).toBeNull();
  expect(parseBook("pacifica", { ...book, l: [[], []] })).toMatchObject({
    bids: [],
    asks: [],
  });
});
test("depth accumulates outward; aggregation preserves quantities", () => {
  const book = displayBook(
    {
      time: Date.now(),
      bids: [
        { price: 100.001, size: 2 },
        { price: 100, size: 3 },
        { price: 99, size: 1 },
      ],
      asks: [
        { price: 101, size: 2 },
        { price: 102, size: 4 },
      ],
    },
    8,
    0.01,
  );
  expect(book.bids).toEqual([
    { price: 100, size: 5, total: 5 },
    { price: 99, size: 1, total: 6 },
  ]);
  expect(book.asks.map((r) => r.total)).toEqual([6, 2]);
  expect(precision(0.5)).toBe(1);
  expect(precision(0.001)).toBe(3);
});
test("BULK observed trades keep the first candle partial and reconcile completed history", () => {
  const t = Date.UTC(2026, 9, 2, 12),
    tracker = new TradeCandles("5m", t + 60000);
  tracker.add([
    { time: t + 30000, price: 999, size: 8 },
    { time: t + 61000, price: 100, size: 1 },
    { time: t + 62000, price: 105, size: 2 },
    { time: t + 61500, price: 99, size: 3 },
  ]);
  const first = tracker.combine([], t + 90000)[0];
  expect(first).toMatchObject({
    open: 100,
    close: 105,
    high: 105,
    low: 99,
    volume: 6,
    partial: true,
  });
  tracker.add([{ time: t + 301000, price: 106, size: 1 }]);
  expect(tracker.combine([], t + 302000).at(-1)?.partial).toBe(false);
  const reconciled = tracker.combine(
    [{ time: t / 1000, open: 98, close: 105, high: 107, low: 97, volume: 20 }],
    t + 302000,
  );
  expect(reconciled[0].volume).toBe(20);
  expect(reconciled[0].partial).toBeUndefined();
});
test("symbol and interval mapping are venue specific; no private endpoints", () => {
  expect(historyUrl("pacifica", "BTC", "5m", 1790951400000)).toContain(
    "symbol=BTC&interval=5m&start_time=",
  );
  expect(historyUrl("bulk", "BTC", "5m", 1790951400000)).toContain(
    "symbol=BTC-USD&interval=5m&startTime=",
  );
  expect(
    parseInfo(
      "bulk",
      [
        {
          symbol: "SOL-USD",
          tickSize: 0.001,
          lotSize: 0.0001,
          maxLeverage: 20,
        },
      ],
      "SOL",
    )?.tick,
  ).toBe(0.001);
  expect(
    parseTrades([{ s: "BTC-USD", px: 100, sz: 1, time: Date.now() }], "SOL"),
  ).toEqual([]);
  const a = { time: 1, open: 1, high: 2, low: 1, close: 2, volume: 2 };
  expect(mergeCandles([a], [{ ...a, volume: 3 }])).toEqual([
    { ...a, volume: 3 },
  ]);
});

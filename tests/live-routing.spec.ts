import { expect, test } from "@playwright/test";
import {
  compareLiveRoutes,
  walkBook,
  BOOK_MAX_AGE_MS,
  BOOK_MAX_SKEW_MS,
  alignedBooks,
  focusedChartMax,
  type ComparisonFeeds,
} from "../src/components/demo/live-routing";
import { MarketFeed } from "../src/components/demo/market-data/feed";
import {
  parseVenueFee,
  FEE_MAX_AGE_MS,
} from "../src/components/demo/market-data/fees";
import {
  parseBook,
  subscriptions,
  type Book,
} from "../src/components/demo/market-data/adapters";
import { money, type RouteInput } from "../src/components/demo/routing";
import { usdcSize } from "../src/components/demo/data";

const now = Date.UTC(2026, 9, 2, 12);
const input: RouteInput = {
  market: "BTC",
  side: "Buy",
  quantity: 0.1,
  leverage: 25,
  slippage: 1,
  allowed: ["pacifica", "bulk"],
  account: "funded",
  snapshot: "balanced",
};
const book = (mid = 86000, size = 1): Book => ({
  time: now,
  bids: [
    { price: mid - 1, size },
    { price: mid - 2, size },
  ],
  asks: [
    { price: mid + 1, size },
    { price: mid + 2, size },
  ],
});
function feeds(): ComparisonFeeds {
  return Object.fromEntries(
    (["pacifica", "bulk", "phoenix"] as const).map((venue) => [
      venue,
      {
        ...new MarketFeed(venue, "BTC", "15m").getSnapshot(),
        connection: "connected",
        book: book(venue === "pacifica" ? 86000 : 86020),
        bookAt: now,
        now,
        fee: {
          takerBps: venue === "pacifica" ? 4 : 3.5,
          source: "fixture",
          label: "Test base tier",
          fetchedAt: now,
        },
      },
    ]),
  ) as ComparisonFeeds;
}

test("focused chart range is presentation-only and samples use real visible book walks", () => {
  expect(focusedChartMax(300, 250000)).toBe(1000);
  expect(focusedChartMax(10000, 250000)).toBe(20000);
  expect(focusedChartMax(25000, 250000)).toBe(50000);
  expect(focusedChartMax(100000, 250000)).toBe(200000);
  expect(focusedChartMax(100000, 15000)).toBe(15000);
  expect(focusedChartMax(Number.MAX_VALUE, 250000)).toBe(250000);
  for (const size of [NaN, Infinity, -100, 0])
    expect(focusedChartMax(size, 250000)).toBe(1000);

  const f = feeds();
  const comparison = compareLiveRoutes({ ...input, notional: 300 }, f, now);
  const focus = focusedChartMax(300, comparison.live!.chartMax);
  for (const curve of comparison.live!.curves.filter((s) => s.points.length)) {
    expect(
      curve.points.filter((p) => p.notional <= focus).length,
    ).toBeGreaterThanOrEqual(60);
    const last = curve.points.at(-1)!;
    expect(last.notional).toBeLessThanOrEqual(curve.capacity);
    for (const point of curve.points) {
      const quote = walkBook(
        curve.venue,
        f[curve.venue].book!,
        input.side,
        point.notional / comparison.reference,
        comparison.reference,
        f[curve.venue].fee!.takerBps,
      );
      expect(point.cost).toBe(quote!.costBps);
    }
  }
  const winner = comparison.best!.venue;
  // Choosing a plot range does not replace or resize the compared order.
  focusedChartMax(comparison.input.notional!, comparison.live!.chartMax);
  expect(comparison.best!.venue).toBe(winner);
  expect(comparison.input.notional).toBe(300);
});

test("USDC intent converts at one shared reference without leverage multiplication or input mutation", () => {
  const requested = { ...input, notional: 10000, quantity: NaN };
  const comparison = compareLiveRoutes(requested, feeds(), now);
  expect(comparison.reference).toBe(86010);
  expect(comparison.input.notional).toBe(10000);
  expect(comparison.input.quantity).toBeCloseTo(10000 / 86010, 12);
  expect(requested.quantity).toBeNaN();
  expect(comparison.ranked).toHaveLength(2);
  expect(
    comparison.ranked.every((q) => q.quantity === comparison.input.quantity),
  ).toBe(true);
  const lowerLeverage = compareLiveRoutes(
    { ...requested, leverage: 5 },
    feeds(),
    now,
  );
  expect(lowerLeverage.input.quantity).toBe(comparison.input.quantity);
  expect(lowerLeverage.best?.totalCost).toBe(comparison.best?.totalCost);
  const f = feeds();
  f.pacifica.book = book(87000);
  f.bulk.book = book(87020);
  const updated = compareLiveRoutes(requested, f, now);
  expect(updated.input.quantity).toBeCloseTo(10000 / 87010, 12);
  expect(comparison.input.quantity).toBeCloseTo(10000 / 86010, 12);
  expect(updated.input.notional).toBe(10000);
  for (const notional of [NaN, Infinity, 0, -1]) {
    const invalid = compareLiveRoutes({ ...input, notional }, feeds(), now);
    expect(invalid.best).toBeNull();
    expect(invalid.input.quantity).toBeNaN();
  }
  const stale = compareLiveRoutes(
    requested,
    feeds(),
    now + BOOK_MAX_AGE_MS + 1,
  );
  expect(stale.best).toBeNull();
  expect(stale.input.notional).toBe(10000);
  expect(stale.input.quantity).toBeNaN();
});

test("USDC size formatting preserves small amounts without NaN or scientific notation", () => {
  expect(usdcSize(10000)).toBe("10,000.00 USDC");
  expect(usdcSize(0.000001)).toBe("0.000001 USDC");
  expect(usdcSize(0.000000001)).toBe("<0.00000001 USDC");
  expect(usdcSize(NaN)).toBe("—");
});

test("public fees use explicit units, base tier and instrument overrides without inventing discounts", () => {
  expect(
    parseVenueFee(
      "pacifica",
      "BTC",
      {
        success: true,
        data: [
          { level: 0, taker_fee_rate: "0.0004" },
          { level: 1, taker_fee_rate: "0.0001" },
        ],
      },
      now,
    )?.takerBps,
  ).toBe(4);
  const scopes = [
    {
      instrument: "global",
      active_policy: { tiers: [{ threshold_volume: 0, taker_bps: 3.5 }] },
    },
    {
      instrument: "BTC-USD",
      active_policy: { tiers: [{ threshold_volume: 0, taker_bps: 5 }] },
    },
  ];
  expect(
    parseVenueFee("bulk", "BTC", { scopes, globalPolicyActive: true }, now)
      ?.takerBps,
  ).toBe(5);
  expect(
    parseVenueFee("bulk", "SOL", { scopes, globalPolicyActive: true }, now)
      ?.takerBps,
  ).toBe(3.5);
  expect(
    parseVenueFee("bulk", "SOL", { scopes, globalPolicyActive: false }, now),
  ).toBeNull();
  for (const bad of [
    null,
    {},
    { success: false, data: [{ level: 0, taker_fee_rate: "0.0004" }] },
    { success: true, data: [{ level: 1, taker_fee_rate: "0.0001" }] },
  ])
    expect(parseVenueFee("pacifica", "BTC", bad, now)).toBeNull();
  expect(
    parseVenueFee(
      "bulk",
      "BTC",
      {
        scopes: [
          ...scopes.slice(0, 1),
          { instrument: "BTC-USD", active_policy: {} },
        ],
        globalPolicyActive: true,
      },
      now,
    ),
  ).toBeNull();
});

test("handoff golden VWAP cases reproduce fees, signs and different buy/sell leaders", () => {
  // Published aggregate VWAP fixture, not a claimed replay of unavailable raw L2.
  const reference = 86271.1850000025,
    quantity = 10000 / reference;
  for (const [venue, buy, sell, fee, buyCost, sellCost] of [
    ["bulk", 86269.87000001, 86259.20369113, 3.5, 3.347520323, 4.888310062],
    ["pacifica", 86273, 86265.92430366, 4, 4.210467261, 4.609542115],
  ] as const) {
    const depth: Book = {
      time: now,
      bids: [{ price: sell, size: 1 }],
      asks: [{ price: buy, size: 1 }],
    };
    expect(
      walkBook(venue, depth, "Buy", quantity, reference, fee)!.costBps,
    ).toBeCloseTo(buyCost, 6);
    expect(
      walkBook(venue, depth, "Sell", quantity, reference, fee)!.costBps,
    ).toBeCloseTo(sellCost, 6);
  }
});

test("walking consumes partial last levels, fees on fills and exact full-size depth only", () => {
  const b = book(100, 2);
  const q = walkBook("bulk", b, "Buy", 3, 100, 4)!;
  expect(q.notional).toBe(304);
  expect(q.venueFee).toBeCloseTo(0.1216, 10);
  expect(q.totalCost).toBeCloseTo(4.1216, 10);
  expect(q.effectivePrice).toBeCloseTo((304 + 0.1216) / 3, 10);
  expect(walkBook("bulk", b, "Buy", 4, 100, 4)).not.toBeNull();
  expect(walkBook("bulk", b, "Buy", 4.00001, 100, 4)).toBeNull();
  const sell = walkBook("bulk", b, "Sell", 3, 100, 4)!;
  expect(sell.notional).toBe(296);
  expect(sell.effectivePrice).toBeCloseTo((296 - sell.venueFee) / 3, 10);
  for (const qty of [NaN, Infinity, 0, -1])
    expect(walkBook("bulk", b, "Buy", qty, 100, 4)).toBeNull();
});

test("ranking is side-aware and adverse-only tolerance allows favourable fills", () => {
  const f = feeds();
  expect(compareLiveRoutes(input, f, now).best?.venue).toBe("pacifica");
  expect(
    compareLiveRoutes({ ...input, side: "Sell" }, f, now).best?.venue,
  ).toBe("bulk");
  expect(
    compareLiveRoutes({ ...input, slippage: 0.00001 }, f, now).best?.venue,
  ).toBe("pacifica");
  expect(
    compareLiveRoutes({ ...input, quantity: 0.01 }, f, now).ranked.every(
      (q) => q.quantity === 0.01,
    ),
  ).toBe(true);
});

test("stale receipt/source, future times, malformed books and missing/expired fees cannot rank", () => {
  const mutations = [
    (f: ComparisonFeeds) => {
      f.bulk.bookAt = now - BOOK_MAX_AGE_MS - 1;
    },
    (f: ComparisonFeeds) => {
      f.bulk.book!.time = now - BOOK_MAX_AGE_MS - 1;
    },
    (f: ComparisonFeeds) => {
      f.bulk.book!.time = now + 501;
    },
    (f: ComparisonFeeds) => {
      f.bulk.connection = "reconnecting";
    },
    (f: ComparisonFeeds) => {
      f.bulk.book!.bids[0].size = -1;
    },
    (f: ComparisonFeeds) => {
      f.bulk.fee = null;
    },
    (f: ComparisonFeeds) => {
      f.bulk.fee!.fetchedAt = now - FEE_MAX_AGE_MS - 1;
    },
  ];
  for (const mutate of mutations) {
    const f = feeds();
    mutate(f);
    const result = compareLiveRoutes(input, f, now);
    expect(result.ranked).toHaveLength(1);
    expect(result.savings).toBeNull();
    const curve = result.live!.curves.find((c) => c.venue === "bulk")!;
    // Delayed data can be visibly retained, never ranked as current.
    expect(curve.points.length === 0 || curve.delayed).toBeTruthy();
    expect(result.explanation).toContain("does not establish a cheaper venue");
  }
});

test("unaligned books withhold rankings and only retain labelled, non-actionable observations", () => {
  for (const key of ["source", "receipt"]) {
    const f = feeds();
    if (key === "source") f.bulk.book!.time -= BOOK_MAX_SKEW_MS + 1;
    else f.bulk.bookAt -= BOOK_MAX_SKEW_MS + 1;
    const result = compareLiveRoutes(input, f, now);
    expect(result.best).toBeNull();
    expect(Number.isNaN(result.reference)).toBe(true);
    expect(result.live?.alignmentReason).toContain("out of sync");
    expect(
      result.live!.curves.every((c) => !c.points.length || c.delayed),
    ).toBe(true);
    expect(result.live?.delayedQuotes.bulk).toBeDefined();
    expect(result.savings).toBeNull();
  }
});

test("a delayed third venue cannot veto an aligned pair", () => {
  const f = feeds();
  f.phoenix.book!.time -= 1500;
  f.phoenix.bookAt -= 1500;
  const result = compareLiveRoutes(
    { ...input, allowed: ["pacifica", "bulk", "phoenix"] },
    f,
    now,
  );
  expect(result.ranked.map((q) => q.venue).sort()).toEqual([
    "bulk",
    "pacifica",
  ]);
  expect(result.live?.aligned).toBe(true);
  expect(result.reference).toBe(86010);
  expect(
    result.candidates.find((c) => c.venue === "phoenix")?.quote,
  ).toBeNull();
  expect(result.live?.delayedQuotes.phoenix).toBeDefined();
  expect(result.live?.curves.find((c) => c.venue === "phoenix")?.delayed).toBe(
    true,
  );
});

test("accepted history aligns independently arriving feeds without using stale frames", () => {
  const f = feeds();
  f.pacifica.book!.time -= 1400;
  const old = book(86020);
  old.time -= 500;
  f.bulk.books = [{ book: old, receivedAt: now - 500 }];
  const result = compareLiveRoutes(input, f, now);
  expect(result.ranked).toHaveLength(2);
  expect(
    result.live?.observations.find((o) => o.venue === "bulk")?.sourceAt,
  ).toBe(now - 500);
  expect(
    result.live?.observations.find((o) => o.venue === "bulk")?.receivedAt,
  ).toBe(now - 500);
  old.time = now - BOOK_MAX_AGE_MS - 1;
  expect(compareLiveRoutes(input, f, now).best).toBeNull();
  old.time = now - 500;
  f.bulk.connection = "reconnecting";
  expect(compareLiveRoutes(input, f, now).ranked.map((q) => q.venue)).toEqual([
    "pacifica",
  ]);
});

test("cohort selection maximizes venue coverage then the conservative receive watermark", () => {
  const earlier = (offset: number) => ({
    book: { ...book(), time: now + offset },
    receivedAt: now + offset,
  });
  const result = alignedBooks({
    pacifica: [earlier(0), earlier(-500)],
    bulk: [earlier(-1100), earlier(-1500)],
    phoenix: [earlier(-1400)],
  });
  expect(Object.keys(result)).toHaveLength(3);
  expect(result.pacifica?.receivedAt).toBe(now - 500);
  expect(result.bulk?.receivedAt).toBe(now - 1100);
  expect(result.phoenix?.receivedAt).toBe(now - 1400);
});

test("whole-second Phoenix timestamps are intervals, not millisecond-precise clock failures", () => {
  const f = feeds();
  f.phoenix.book!.time = now - 1700;
  f.phoenix.book!.timePrecisionMs = 1000;
  const result = compareLiveRoutes(
    { ...input, allowed: ["pacifica", "bulk", "phoenix"] },
    f,
    now,
  );
  expect(result.ranked).toHaveLength(3);
  expect(result.live?.curves.every((c) => !c.delayed)).toBe(true);
  f.phoenix.bookAt = now - BOOK_MAX_AGE_MS - 1;
  expect(
    compareLiveRoutes(result.input, f, now).ranked.map((q) => q.venue),
  ).not.toContain("phoenix");
});

test("delayed presentation expires and never bypasses bad books, fees, exclusions or connections", () => {
  for (const side of ["Buy", "Sell"] as const) {
    const f = feeds();
    const request = { ...input, side, notional: 1000 };
    const delayed = compareLiveRoutes(request, f, now + 3000);
    expect(delayed.best).toBeNull();
    expect(delayed.ranked).toEqual([]);
    expect(delayed.reference).toBeNaN();
    expect(
      delayed.live?.curves.every((c) => c.points.length === 0 || c.delayed),
    ).toBe(true);
    expect(delayed.live?.delayedQuotes.bulk?.quantity).toBe(
      delayed.live?.delayedQuotes.pacifica?.quantity,
    );
    const expired = compareLiveRoutes(request, f, now + 10001);
    expect(expired.live?.curves.every((c) => !c.points.length)).toBe(true);
    expect(expired.live?.delayedQuotes).toEqual({});
  }
  for (const change of [
    (f: ComparisonFeeds) => {
      f.bulk.connection = "offline";
    },
    (f: ComparisonFeeds) => {
      f.bulk.book!.time = now + 6000;
    },
    (f: ComparisonFeeds) => {
      f.bulk.book!.asks[0].size = -1;
    },
    (f: ComparisonFeeds) => {
      f.bulk.fee = null;
    },
    (f: ComparisonFeeds) => {
      f.bulk.fee!.takerBps = -1;
    },
    (f: ComparisonFeeds) => {
      f.bulk.fee!.fetchedAt = now + 10000;
    },
    (f: ComparisonFeeds) => {
      f.bulk.fee!.fetchedAt = now - FEE_MAX_AGE_MS;
    },
  ]) {
    const f = feeds();
    change(f);
    expect(
      compareLiveRoutes(input, f, now + 3000).live?.delayedQuotes.bulk,
    ).toBeUndefined();
  }
  expect(
    compareLiveRoutes({ ...input, allowed: ["pacifica"] }, feeds(), now + 3000)
      .live?.delayedQuotes.bulk,
  ).toBeUndefined();
});

test("partial visible depth is not a liquidity judgement or a savings claim", () => {
  const f = feeds();
  f.pacifica.book = book(86000, 0.01);
  const result = compareLiveRoutes(input, f, now);
  expect(result.best?.venue).toBe("bulk");
  expect(result.candidates[0].reason).toContain("Insufficient visible depth");
  expect(result.candidates[0].quote).toBeNull();
  expect(result.savings).toBeNull();
  const curve = result.live!.curves[0];
  expect(curve.points.at(-1)!.notional).toBeCloseTo(0.02 * result.reference, 8);
  expect(curve.points.every((p) => p.notional <= curve.capacity)).toBe(true);
});

test("near ties retain venue preference and suppress savings; curves preserve negative costs", () => {
  const f = feeds();
  f.bulk.book = book(86000);
  f.bulk.fee!.takerBps = 4.01;
  const result = compareLiveRoutes(
    { ...input, allowed: ["bulk", "pacifica"] },
    f,
    now,
  );
  expect(result.live!.tied).toBe(true);
  expect(result.best!.venue).toBe("bulk");
  expect(result.savings).toBeNull();
  f.bulk.book = book(86200);
  const negative = compareLiveRoutes(input, f, now);
  expect(negative.live!.curves[0].points.some((p) => p.cost < 0)).toBe(true);
  expect(money(-0.001)).toBe("−<$0.01");
});

test("no feeds means no fictional reference; empty and stale accounts cannot review", () => {
  const f = feeds();
  f.bulk.book = f.pacifica.book = null;
  const result = compareLiveRoutes(input, f, now);
  expect(result.best).toBeNull();
  expect(Number.isNaN(result.reference)).toBe(true);
  for (const account of ["empty", "stale"] as const)
    expect(
      compareLiveRoutes({ ...input, account }, feeds(), now).best,
    ).toBeNull();
  expect(
    compareLiveRoutes({ ...input, allowed: [] }, feeds(), now).best,
  ).toBeNull();
});

test("comparison subscriptions are book-only, unaggregated and preserve raw timestamp strings", () => {
  expect(subscriptions("bulk", "BTC", "15m", "comparison")).toEqual([
    {
      method: "subscribe",
      subscription: [{ type: "l2Snapshot", symbol: "BTC-USD", nlevels: 1000 }],
    },
  ]);
  expect(subscriptions("pacifica", "BTC", "15m", "comparison")).toHaveLength(1);
  const decoded = parseBook("bulk", {
    updateType: "snapshot",
    timestamp: "1790938712127123456",
    levels: [[{ px: 100, sz: 1 }], [{ px: 101, sz: 1 }]],
  });
  expect(decoded?.time).toBe(1790938712127);
  expect(decoded?.sourceTime).toBe("1790938712127123456");
  expect(
    parseBook("pacifica", {
      t: now,
      l: [
        [
          { p: 99, a: 1 },
          { p: 100, a: 1 },
        ],
        [{ p: 101, a: 1 }],
      ],
    }),
  ).toBeNull();
});

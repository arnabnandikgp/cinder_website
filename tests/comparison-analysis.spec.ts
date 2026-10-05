import { expect, test } from "@playwright/test";
import {
  ComparisonWindow,
  guardAnalysis,
  liveAnalysis,
  rankAnalysis,
} from "../src/components/demo/comparison-analysis";
import {
  compareLiveRoutes,
  comparisonVenues,
  type ComparisonFeeds,
} from "../src/components/demo/live-routing";
import { MarketFeed } from "../src/components/demo/market-data/feed";
import type { RouteInput } from "../src/components/demo/routing";

const start = Date.UTC(2026, 9, 4, 12);
const input: RouteInput = {
  market: "SOL",
  side: "Buy",
  quantity: NaN,
  notional: 300,
  leverage: 25,
  slippage: 5,
  allowed: [...comparisonVenues],
  account: "funded",
  snapshot: "balanced",
};
function feeds(
  now: number,
  prices = [150, 151, 150.5],
  size = 100,
): ComparisonFeeds {
  return Object.fromEntries(
    comparisonVenues.map((venue, i) => [
      venue,
      {
        ...new MarketFeed(venue, "SOL", "15m").getSnapshot(),
        connection: "connected",
        now,
        bookAt: now,
        book: {
          time: now,
          bids: [{ price: prices[i] - 0.01, size }],
          asks: [{ price: prices[i] + 0.01, size }],
        },
        fee: {
          takerBps: i === 0 ? 4 : 3.5,
          fetchedAt: start,
          source: "fixture",
          label: "Public base tier",
        },
      },
    ]),
  ) as ComparisonFeeds;
}
function compare(now: number, f = feeds(now), intent = input) {
  return compareLiveRoutes(intent, f, now, { curves: false });
}
function fill(
  window: ComparisonWindow,
  create = (t: number) => feeds(t),
  intent = input,
) {
  let current = compare(start, create(start), intent);
  for (let i = 0; i <= 20; i++) {
    const t = start + i * 250;
    current = compare(t, create(t), intent);
    window.capture(current, t);
  }
  return current;
}

test("full-window averages reconcile components, dollars and exact-size plot points", () => {
  for (const side of ["Buy", "Sell"] as const) {
    const window = new ComparisonWindow(),
      intent = { ...input, side };
    const current = fill(
      window,
      (t) => feeds(t, [150 + (t - start) / 10000, 151, 150.5]),
      intent,
    );
    const frame = window.average(current, start + 5000);
    expect(frame.ready).toBe(true);
    expect(frame.coverage).toBe(20);
    expect(frame.rows).toHaveLength(3);
    for (const row of frame.rows) {
      expect(row.reason).toBeNull();
      expect(row.costs!.priceBps + row.costs!.feeBps).toBeCloseTo(
        row.costs!.totalBps,
        10,
      );
      expect(row.dollars).toBeCloseTo((row.costs!.totalBps * 300) / 10000, 10);
      expect(
        frame.curves
          .find((c) => c.venue === row.venue)!
          .points.find((p) => p.notional === 300)!.cost,
      ).toBeCloseTo(row.costs!.totalBps, 10);
    }
    const ranked = rankAnalysis(frame);
    expect(ranked.rows.map((r) => r.costs!.totalBps)).toEqual(
      ranked.rows.map((r) => r.costs!.totalBps).sort((a, b) => a - b),
    );
  }
});

test("extra messages in the same clock slot cannot bias an average", () => {
  const a = new ComparisonWindow(),
    b = new ComparisonWindow();
  let current = compare(start);
  for (let i = 0; i <= 20; i++) {
    const t = start + i * 250;
    current = compare(t);
    a.capture(current, t);
    b.capture(current, t);
    for (let j = 1; j < 40; j++)
      b.capture(compare(t + j, feeds(t + j, [150.4, 151, 150.5])), t + j);
  }
  expect(b.average(current, start + 5000)).toEqual(
    a.average(current, start + 5000),
  );
});

test("warmup and interrupted coverage never manufacture a five-second average", () => {
  const window = new ComparisonWindow();
  const current = compare(start);
  window.capture(current, start);
  expect(window.average(current, start + 4999).status).toBe(
    "Collecting 5s average",
  );
  const later = compare(start + 5000);
  window.capture(later, start + 5000);
  const partial = window.average(later, start + 5000);
  expect(partial.ready).toBe(false);
  expect(partial.rows.every((r) => !r.costs)).toBe(true);
  expect(partial.curves.every((c) => !c.points.length)).toBe(true);
  fill(window);
  expect(window.average(compare(start + 11000), start + 11000).ready).toBe(
    false,
  );
});

test("healthy pair uses matching slots and keeps local costs independent of a missing third venue", () => {
  const window = new ComparisonWindow();
  const current = fill(window, (t) => {
    const f = feeds(t, [150, 151, 157]);
    if ((t - start) / 250 < 16)
      f.phoenix = { ...f.phoenix, connection: "offline" };
    return f;
  });
  const frame = window.average(current, start + 5000);
  expect(frame.ready).toBe(true);
  expect(frame.coverage).toBe(20);
  expect(frame.rows.find((r) => r.venue === "phoenix")!.reason).toBe(
    "Insufficient shared coverage",
  );
  const pair = compare(start + 5000, feeds(start + 5000), {
    ...input,
    allowed: ["pacifica", "bulk"],
  });
  for (const row of frame.rows.filter((r) => !r.reason))
    expect(row.costs!.totalBps).toBeCloseTo(
      pair.candidates.find((c) => c.venue === row.venue)!.quote!.costBps,
      10,
    );
});

test("coverage cannot combine disjoint timestamps or treat gaps as cheap quotes", () => {
  const window = new ComparisonWindow();
  const current = fill(window, (t) => {
    const f = feeds(t);
    if ((t - start) / 250 < 10) f.bulk.connection = "offline";
    else if (t < start + 5000) f.pacifica.connection = "offline";
    f.phoenix.connection = "offline";
    return f;
  });
  const frame = window.average(current, start + 5000);
  expect(frame.ready).toBe(false);
  expect(rankAnalysis(frame).count).toBe(0);
});

test("16 matched slots meet coverage; 15 do not", () => {
  for (const missing of [4, 5]) {
    const window = new ComparisonWindow();
    const current = fill(window, (t) => {
      const f = feeds(t);
      if ((t - start) / 250 >= 1 && (t - start) / 250 <= missing)
        for (const v of comparisonVenues) f[v].connection = "offline";
      return f;
    });
    const frame = window.average(current, start + 5000);
    expect(frame.ready).toBe(missing === 4);
    expect(frame.coverage).toBe(missing === 4 ? 16 : 0);
  }
});

test("new size, side, market, preferences or risk intent reset temporal history", () => {
  for (const change of [
    { notional: 500 },
    { side: "Sell" as const },
    { market: "BTC" as const },
    { allowed: ["pacifica", "bulk"] as const },
    { slippage: 2 },
    { leverage: 10 },
    { account: "stale" as const },
  ]) {
    const window = new ComparisonWindow();
    fill(window);
    const intent = {
      ...input,
      ...change,
      allowed: [...(change.allowed ?? input.allowed)],
    };
    const current = compare(start + 5250, feeds(start + 5250), intent);
    window.capture(current, start + 5250);
    expect(window.average(current, start + 5250).ready).toBe(false);
  }
});

test("unchanged fee polls preserve averages, while a rate change resets the window", () => {
  const window = new ComparisonWindow();
  fill(window);
  let t = start + 5250;
  const f = feeds(t);
  f.pacifica.fee = { ...f.pacifica.fee!, fetchedAt: t };
  let current = compare(t, f);
  window.capture(current, t);
  expect(window.average(current, t).ready).toBe(true);
  t += 250;
  const next = feeds(t);
  next.pacifica.fee = { ...next.pacifica.fee!, takerBps: 2.8 };
  current = compare(t, next);
  window.capture(current, t);
  expect(window.average(current, t).ready).toBe(false);
  expect(window.average(current, t).rows.every((r) => !r.costs)).toBe(true);
});

test("a changed fee clears old live and averaged costs and curves before publication", () => {
  const window = new ComparisonWindow();
  const prior = fill(window);
  const frames = [
    liveAnalysis(compareLiveRoutes(input, feeds(start + 5000), start + 5000)),
    window.average(prior, start + 5000),
  ];
  for (const offset of [250, 1500]) {
    const t = start + 5000 + offset;
    const f = feeds(t);
    f.pacifica.fee = { ...f.pacifica.fee!, takerBps: 2.8 };
    for (const frame of frames) {
      const guarded = guardAnalysis(frame, compare(t, f), f, t);
      const row = guarded.rows.find((r) => r.venue === "pacifica")!;
      expect(row.reason).toContain("Fee basis changed");
      expect(row.costs).toBeNull();
      expect(row.dollars).toBeNull();
      expect(
        guarded.curves.find((c) => c.venue === "pacifica")!.points,
      ).toHaveLength(0);
    }
  }
});

test("curve stops at minimum observed depth, never averaging only fillable periods", () => {
  const window = new ComparisonWindow();
  const current = fill(window, (t) =>
    feeds(t, [150, 151, 150.5], t === start + 2500 ? 3 : 100),
  );
  const frame = window.average(current, start + 5000);
  expect(frame.coverage).toBe(20);
  for (const curve of frame.curves) {
    const midpoint = { pacifica: 150, bulk: 151, phoenix: 150.5 }[curve.venue];
    expect(curve.capacity).toBeCloseTo(3 * midpoint, 10);
    expect(curve.points.at(-1)!.notional).toBeCloseTo(3 * midpoint, 10);
    expect(curve.points.every((p) => p.notional <= curve.capacity)).toBe(true);
  }
});

test("lowest average may differ from best now; failures immediately remove historical eligibility", () => {
  const window = new ComparisonWindow();
  fill(window, (t) => {
    const f = feeds(t);
    f.bulk.book!.bids[0].price = 150.95;
    f.bulk.book!.asks[0].price = 151.05;
    f.phoenix.book!.bids[0].price = 150.4;
    f.phoenix.book!.asks[0].price = 150.6;
    return f;
  });
  const t = start + 5250,
    f = feeds(t, [151.4, 150, 150.5]),
    live = (() => {
      f.pacifica.book!.bids[0].price = 151.32;
      f.pacifica.book!.asks[0].price = 151.48;
      f.phoenix.book!.bids[0].price = 150.4;
      f.phoenix.book!.asks[0].price = 150.6;
      return compare(t, f);
    })();
  window.capture(live, t);
  const frame = window.average(live, t);
  expect(rankAnalysis(frame).lowest).toBe("pacifica");
  expect(live.best!.venue).toBe("bulk");
  f.pacifica.connection = "offline";
  const guarded = guardAnalysis(frame, compare(t, f), f, t);
  expect(guarded.rows.find((r) => r.venue === "pacifica")!.costs).toBeNull();
  expect(rankAnalysis(guarded).lowest).not.toBe("pacifica");
  expect(
    guarded.curves.find((c) => c.venue === "pacifica")!.points,
  ).toHaveLength(0);
});

test("a suspended analytical publisher expires even if incoming feeds remain healthy", () => {
  const f = feeds(start),
    captured = compareLiveRoutes(input, f, start);
  const frame = liveAnalysis(captured),
    t = start + 2100,
    newer = feeds(t);
  const guarded = guardAnalysis(frame, compare(t, newer), newer, t);
  expect(rankAnalysis(guarded).count).toBe(0);
  expect(
    guarded.rows.every((r) => r.delayed && r.reason!.startsWith("Stale book")),
  ).toBe(true);
  expect(guarded.curves.every((c) => c.delayed)).toBe(true);
});

test("normal publication lag does not create artificial stale warnings on healthy current feeds", () => {
  const older = feeds(start);
  for (const v of comparisonVenues) older[v].book!.time = start - 1500;
  const frame = liveAnalysis(compareLiveRoutes(input, older, start));
  const t = start + 800,
    newer = feeds(t);
  for (const v of comparisonVenues) newer[v].book!.time = t - 1500;
  const guarded = guardAnalysis(frame, compare(t, newer), newer, t);
  expect(rankAnalysis(guarded).count).toBe(3);
  expect(guarded.curves.every((c) => !c.delayed)).toBe(true);
});

test("near ties and single-venue averages do not claim a clear cheapest venue", () => {
  for (const allowed of [
    ["pacifica", "bulk", "phoenix"],
    ["pacifica"],
  ] as const) {
    const window = new ComparisonWindow();
    const current = fill(
      window,
      (t) => {
        const f = feeds(t, [150, 150, 150]);
        f.pacifica.fee!.takerBps = 3.9;
        return f;
      },
      {
        ...input,
        allowed: [...allowed],
      },
    );
    expect(
      rankAnalysis(window.average(current, start + 5000)).lowest,
    ).toBeNull();
  }
});

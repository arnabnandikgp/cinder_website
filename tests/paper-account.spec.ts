import { test, expect } from "@playwright/test";
import {
  cancelPaperOrder,
  decodePaperAccount,
  newPaperAccount,
  paperTotals,
  placePaperOrder,
  tickPaperAccount,
  paperValuation,
  previewPaperOrder,
} from "../src/components/demo/paper-account";
import type { Draft } from "../src/components/demo/data";
import { MarketFeed } from "../src/components/demo/market-data/feed";
import {
  compareLiveRoutes,
  type ComparisonFeeds,
} from "../src/components/demo/live-routing";
const now = Date.UTC(2026, 9, 5, 12);
const wallet = "11111111111111111111111111111111";
const feed = (mid = 100, size = 10000) => ({
  ...new MarketFeed("pacifica", "SOL", "15m").getSnapshot(),
  connection: "connected" as const,
  now,
  bookAt: now,
  book: {
    time: now,
    bids: [{ price: mid - 0.01, size }],
    asks: [{ price: mid + 0.01, size }],
  },
  fee: { takerBps: 2.8, fetchedAt: now, source: "test", label: "Test" },
});
const draft = (patch: Partial<Draft> = {}): Draft => ({
  id: "",
  market: "SOL",
  venue: "pacifica",
  mode: "manual",
  allowed: ["pacifica"],
  side: "Buy",
  type: "Market",
  size: "1000",
  sizeUnit: "USDC",
  limit: "99",
  leverage: "10",
  slippage: "0.5",
  ...patch,
});
test("paper credit, fill, netting and margin conservation", () => {
  const a = newPaperAccount(wallet, now);
  expect(paperTotals(a)).toEqual({
    cash: 10000,
    margin: 0,
    reserved: 0,
    available: 10000,
  });
  const r = placePaperOrder(a, draft(), feed(), now);
  expect(a.positions).toHaveLength(0); // Immutable atomic intent.
  expect(r.order.status).toBe("Filled");
  expect(r.account.positions[0].quantity).toBe(10);
  expect(r.account.positions[0].margin).toBeCloseTo(100.01, 6);
  expect(r.account.cash).toBeCloseTo(9999.719972, 6);
  expect(r.account.events.slice(0, 4).map((e) => e.category)).toEqual([
    "fees",
    "trades",
    "orders",
    "transfers",
  ]);
  const closed = placePaperOrder(
    r.account,
    draft({ side: "Sell", reduceOnly: true }),
    feed(),
    now,
    100,
    10,
  ).account;
  expect(closed.positions).toHaveLength(0);
  expect(closed.cash).toBeCloseTo(9999.24, 6);
  expect(paperTotals(closed).available).toBe(closed.cash);
  expect(closed.events[0].title).toBe("Paper margin returned");
});

test("router sizing, preview, paper fill and persisted local-cost receipt reconcile for buys and sells", () => {
  for (const side of ["Buy", "Sell"] as const) {
    const f: ComparisonFeeds = {
      pacifica: feed(100),
      bulk: { ...feed(120), fee: { ...feed().fee, takerBps: 2.2 } },
      phoenix: { ...feed(110), connection: "offline" },
    };
    const comparison = compareLiveRoutes(
      {
        market: "SOL",
        side,
        quantity: NaN,
        notional: 1000,
        leverage: 10,
        slippage: 0.5,
        allowed: ["pacifica", "bulk"],
        snapshot: "balanced",
        account: "funded",
        availableCollateral: 10000,
      },
      f,
      now,
    );
    const selected = comparison.best!;
    expect(selected.venue).toBe("bulk");
    expect(selected.quantity).toBeCloseTo(1000 / 120, 12);
    const a = newPaperAccount(wallet, now);
    const d = draft({
      venue: "bulk",
      mode: "auto",
      side,
      route: { ...comparison, savedAt: new Date(now).toISOString() },
    });
    const preview = previewPaperOrder(
      a,
      d,
      f.bulk,
      now,
      selected.reference,
      selected.quantity,
    )!;
    const result = placePaperOrder(
      a,
      d,
      f.bulk,
      now,
      selected.reference,
      selected.quantity,
    );
    expect(result.order.quantity).toBe(selected.quantity);
    expect(result.account.fills[0].quantity).toBe(selected.quantity);
    expect(result.account.fills[0].fee).toBeCloseTo(selected.venueFee, 10);
    expect(result.order.execution).toMatchObject({
      costBasis: "venue-midpoint",
      reference: 120,
      costBps: selected.costBps,
    });
    // Ledger cash is settled to six decimals before the final margin total.
    expect(preview.availableAfter).toBeCloseTo(
      paperTotals(result.account).available,
      5,
    );
    expect(decodePaperAccount(JSON.stringify(result.account), wallet)).toEqual(
      result.account,
    );
    // Previously recorded benchmark values must not be silently recalculated.
    delete result.order.execution!.costBasis;
    result.order.execution!.costBps = -2;
    const legacy = decodePaperAccount(JSON.stringify(result.account), wallet)!;
    expect(legacy.orders[0].execution!.costBps).toBe(-2);
    expect(legacy.orders[0].execution!.costBasis).toBeUndefined();
    // A fresh, widened book can reject the same intent; old preview is no authority.
    expect(() =>
      placePaperOrder(
        a,
        d,
        {
          ...f.bulk,
          book: {
            ...f.bulk.book!,
            bids: [{ price: 118, size: 1000 }],
            asks: [{ price: 122, size: 1000 }],
          },
        },
        now,
        selected.reference,
        selected.quantity,
      ),
    ).toThrow(/slippage/);
    const moved = side === "Buy" ? 125 : 115;
    expect(() =>
      placePaperOrder(
        a,
        d,
        { ...f.bulk, book: feed(moved).book },
        now,
        selected.reference,
        selected.quantity,
      ),
    ).toThrow(/slippage/);
  }
});
test("fees, depth, freshness, slippage, margin and reduce-only are enforced", () => {
  const a = newPaperAccount(wallet, now);
  expect(() =>
    placePaperOrder(a, draft({ size: "200000" }), feed(), now),
  ).toThrow(/collateral/);
  expect(() =>
    placePaperOrder(a, draft(), { ...feed(), bookAt: now - 10000 }, now),
  ).toThrow(/Stale/);
  expect(() =>
    placePaperOrder(a, draft(), { ...feed(), fee: null }, now),
  ).toThrow(/fee/);
  expect(() => placePaperOrder(a, draft(), feed(100, 1), now)).toThrow(/depth/);
  expect(() =>
    placePaperOrder(a, draft({ slippage: "0.001" }), feed(), now),
  ).toThrow(/slippage/);
  expect(() =>
    placePaperOrder(a, draft({ reduceOnly: true }), feed(), now),
  ).toThrow(/Reduce-only/);
  expect(a.orders).toHaveLength(0);
});
test("closing releases committed margin to cover fees even with no spare cash", () => {
  const a = placePaperOrder(
    newPaperAccount(wallet, now),
    draft(),
    feed(),
    now,
  ).account;
  // Commit the remaining balance to another resting intent.
  a.orders.push({
    id: "P-O-reserved",
    draft: draft({ type: "Limit", limit: "90" }),
    quantity: 1,
    reserve: paperTotals(a).available,
    status: "Open",
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    bracket: {},
  });
  expect(paperTotals(a).available).toBeCloseTo(0, 6);
  const closed = placePaperOrder(
    a,
    draft({ side: "Sell", reduceOnly: true }),
    feed(),
    now,
    100,
    10,
  ).account;
  expect(closed.positions).toHaveLength(0);
  expect(paperTotals(closed).available).toBeGreaterThan(99);
});
test("resting limits reserve funds, cancel releases them, matching books fill them", () => {
  const a = newPaperAccount(wallet, now);
  const r = placePaperOrder(
    a,
    draft({ type: "Limit", limit: "99", tif: "GTC" }),
    feed(),
    now,
  );
  expect(r.order.status).toBe("Open");
  expect(r.account.fills).toHaveLength(0);
  expect(paperTotals(r.account).reserved).toBeGreaterThan(99);
  const cancelled = cancelPaperOrder(r.account, r.order.id, now);
  expect(paperTotals(cancelled).available).toBe(10000);
  expect(cancelled.orders[0].status).toBe("Cancelled");
  const filled = tickPaperAccount(
    r.account,
    "SOL",
    { pacifica: feed(98) },
    now,
  );
  expect(filled.orders[0].status).toBe("Filled");
  expect(filled.fills).toHaveLength(1);
  expect(tickPaperAccount(filled, "SOL", { pacifica: feed(98) }, now)).toBe(
    filled,
  );
  expect(() =>
    placePaperOrder(
      a,
      draft({ type: "Limit", limit: "101", tif: "ALO" }),
      feed(),
      now,
    ),
  ).toThrow(/Post-only/);
  expect(
    placePaperOrder(
      a,
      draft({ type: "Limit", limit: "99", tif: "IOC" }),
      feed(),
      now,
    ).order.status,
  ).toBe("Cancelled");
});
test("TP/SL are side-aware, trigger full reduce-only paper exits and never execute twice", () => {
  const a = placePaperOrder(
    newPaperAccount(wallet, now),
    draft(),
    feed(),
    now,
    undefined,
    undefined,
    { tp: 102, sl: 98 },
  ).account;
  expect(() =>
    placePaperOrder(a, draft(), feed(), now, undefined, undefined, { tp: 98 }),
  ).toThrow(/TP/);
  const hit = tickPaperAccount(a, "SOL", { pacifica: feed(103) }, now);
  expect(hit.positions).toHaveLength(0);
  expect(hit.fills).toHaveLength(2);
  expect(
    hit.events.some((e) => e.title === "Paper take profit triggered"),
  ).toBe(true);
  expect(tickPaperAccount(hit, "SOL", { pacifica: feed(103) }, now)).toBe(hit);
  const short = placePaperOrder(
    newPaperAccount(wallet, now),
    draft({ side: "Sell" }),
    feed(),
    now,
    undefined,
    undefined,
    { tp: 98, sl: 102 },
  ).account;
  const stop = tickPaperAccount(short, "SOL", { pacifica: feed(103) }, now);
  expect(stop.positions).toHaveLength(0);
  expect(stop.events.some((e) => e.title === "Paper stop loss triggered")).toBe(
    true,
  );
});
test("persisted records reject corruption and cross-wallet reuse", () => {
  const a = placePaperOrder(
    newPaperAccount(wallet, now),
    draft(),
    feed(),
    now,
  ).account;
  expect(decodePaperAccount(JSON.stringify(a), wallet)).toEqual(a);
  expect(decodePaperAccount(JSON.stringify(a), "another-wallet")).toBeNull();
  expect(decodePaperAccount("bad json", wallet)).toBeNull();
  const corruptExecution = structuredClone(a);
  corruptExecution.orders[0].execution = {} as never;
  expect(
    decodePaperAccount(JSON.stringify(corruptExecution), wallet),
  ).toBeNull();
  a.positions[0].margin = -1;
  expect(decodePaperAccount(JSON.stringify(a), wallet)).toBeNull();
});

test("equity values every position, but unrealised PnL never expands paper spending capacity", () => {
  const a = newPaperAccount(wallet, now);
  a.positions = [
    {
      id: "pacifica-SOL",
      venue: "pacifica",
      market: "SOL",
      quantity: 10,
      entry: 100,
      margin: 100,
      leverage: 10,
    },
    {
      id: "bulk-BTC",
      venue: "bulk",
      market: "BTC",
      quantity: -0.01,
      entry: 80000,
      margin: 80,
      leverage: 10,
    },
  ];
  expect(
    paperValuation(a, { "pacifica-SOL": 102, "bulk-BTC": 79000 }),
  ).toMatchObject({ equity: 10030, unrealized: 30, missing: [] });
  expect(paperTotals(a).available).toBe(9820);
  for (const invalid of [undefined, 0, NaN, Infinity]) {
    const result = paperValuation(a, {
      "pacifica-SOL": 102,
      "bulk-BTC": invalid,
    });
    expect(result.equity).toBeNull();
    expect(result.unrealized).toBeNull();
    expect(result.missing.map((p) => p.id)).toEqual(["bulk-BTC"]);
  }
  expect(
    paperValuation(a, { "pacifica-SOL": 90, "bulk-BTC": 81000 }).equity,
  ).toBe(9890);
  expect(paperValuation(newPaperAccount(wallet, now), {}).equity).toBe(10000);
});

test("inline fill impact matches the ledger for increases, reductions, reversals and other venues", () => {
  const a = placePaperOrder(
    newPaperAccount(wallet, now),
    draft(),
    feed(),
    now,
  ).account;
  for (const intent of [
    draft({ size: "500" }),
    draft({ side: "Sell", size: "500", reduceOnly: true }),
    draft({ side: "Sell", size: "2000" }),
    draft({ venue: "bulk", side: "Sell", size: "1000" }),
  ]) {
    const preview = previewPaperOrder(a, intent, feed(), now)!;
    const after = placePaperOrder(a, intent, feed(), now).account;
    expect(preview.reservation).toBe(false);
    expect(preview.reason).toBeNull();
    expect(preview.availableAfter).toBeCloseTo(paperTotals(after).available, 5);
    const delta = paperTotals(after).margin - paperTotals(a).margin;
    expect(preview.margin).toBeCloseTo(Math.max(0, delta), 5);
    expect(preview.released).toBeCloseTo(Math.max(0, -delta), 5);
    expect(preview.fees).toBeCloseTo(after.fills[0].fee, 5);
  }
  const reducing = previewPaperOrder(
    a,
    draft({ side: "Sell", size: "500", reduceOnly: true }),
    feed(),
    now,
  )!;
  expect(reducing.margin).toBe(0);
  expect(reducing.released).toBeGreaterThan(50);
});

test("resting reservation is not a prematurely released position requirement", () => {
  const a = placePaperOrder(
    newPaperAccount(wallet, now),
    draft({ side: "Sell" }),
    feed(),
    now,
  ).account;
  const intent = draft({ type: "Limit", limit: "90", size: "500" });
  const preview = previewPaperOrder(a, intent, feed(), now)!;
  const after = placePaperOrder(a, intent, feed(), now).account;
  expect(preview.reservation).toBe(true);
  expect(preview.released).toBe(0);
  expect(preview.availableAfter).toBeCloseTo(paperTotals(after).available, 5);
  expect(paperTotals(after).margin).toBe(paperTotals(a).margin);
  expect(paperTotals(after).reserved).toBeCloseTo(
    preview.margin + preview.fees,
    5,
  );
  expect(
    previewPaperOrder(a, draft({ size: "1000000" }), feed(), now)?.reason,
  ).toContain("Not enough available margin");
  expect(
    previewPaperOrder(a, draft(), { ...feed(), bookAt: now - 10000 }, now),
  ).toBeNull();
  expect(
    previewPaperOrder(
      a,
      draft({ type: "Limit", limit: "101", tif: "ALO" }),
      feed(),
      now,
    )?.reason,
  ).toContain("Post-only");
});

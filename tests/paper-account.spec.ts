import { test, expect } from "@playwright/test";
import {
  cancelPaperOrder,
  decodePaperAccount,
  newPaperAccount,
  paperTotals,
  placePaperOrder,
  tickPaperAccount,
} from "../src/components/demo/paper-account";
import type { Draft } from "../src/components/demo/data";
import { MarketFeed } from "../src/components/demo/market-data/feed";
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

import { expect, test } from "@playwright/test";
import {
  compareRoutes,
  fixtureBook,
  parseAmount,
  quoteVenue,
  type RouteInput,
} from "../src/components/demo/routing";

const base: RouteInput = {
  market: "SOL",
  side: "Buy",
  quantity: 10000 / 152,
  leverage: 25,
  slippage: 0.5,
  allowed: ["pacifica", "bulk", "velocity"],
  snapshot: "balanced",
  account: "funded",
};

test("book walking, fees and reference cost reconcile without double-counting impact", () => {
  const q = quoteVenue("SOL", "pacifica", "Buy", 10000 / 152, "balanced")!;
  const book = fixtureBook("SOL", "pacifica", "Buy", "balanced");
  const notional =
    book[0].quantity * book[0].price + book[1].quantity * book[1].price;
  expect(q.notional).toBeCloseTo(notional, 8);
  expect(q.averageFill).toBeCloseTo(notional / q.quantity, 8);
  expect(q.venueFee).toBeCloseTo(notional * 0.00028, 8);
  expect(q.cinderFee).toBeCloseTo(notional * 0.00006, 8);
  expect(q.totalCost).toBeCloseTo(notional - 10000 + q.totalFees, 8);
  expect(q.costBps).toBeCloseTo(q.totalCost, 8);
});

test("route changes with size and the lowest fee does not automatically win", () => {
  const small = compareRoutes(base);
  expect(small.best?.venue).toBe("pacifica");
  const cheapestFee = [...small.ranked].sort(
    (a, b) => a.totalFees - b.totalFees,
  )[0];
  expect(cheapestFee.venue).toBe("velocity");
  expect(compareRoutes({ ...base, quantity: 100000 / 152 }).best?.venue).toBe(
    "bulk",
  );
  expect(compareRoutes({ ...base, snapshot: "thin" }).best?.venue).toBe("bulk");
});

test("sell estimates use bids and maximize the net effective price", () => {
  const result = compareRoutes({ ...base, side: "Sell" });
  expect(result.best?.venue).toBe("bulk");
  for (const q of result.ranked) {
    expect(q.averageFill).toBeLessThan(result.reference);
    expect(q.totalCost).toBeCloseTo(
      q.quantity * (result.reference - q.averageFill) + q.totalFees,
      8,
    );
    expect(q.effectivePrice).toBeCloseTo(
      q.averageFill - q.totalFees / q.quantity,
      8,
    );
  }
  expect(result.best?.effectivePrice).toBe(
    Math.max(...result.ranked.map((q) => q.effectivePrice)),
  );
});

test("full size, freshness, permissions, slippage and margin gate every quote", () => {
  const large = { ...base, quantity: 100000 / 152 };
  expect(
    compareRoutes(large).candidates.find((c) => c.venue === "velocity")?.reason,
  ).toContain("Insufficient depth");
  expect(compareRoutes({ ...large, snapshot: "stale" }).best?.venue).not.toBe(
    "bulk",
  );
  expect(
    compareRoutes({ ...base, snapshot: "unavailable", allowed: ["velocity"] })
      .best,
  ).toBeNull();
  expect(compareRoutes({ ...base, allowed: [] }).best).toBeNull();
  expect(compareRoutes({ ...base, account: "empty" }).best).toBeNull();
  expect(compareRoutes({ ...base, account: "stale" }).best).toBeNull();
  expect(compareRoutes({ ...base, leverage: 1 }).best).toBeNull();
  expect(compareRoutes({ ...large, slippage: 0.01 }).best).toBeNull();
  expect(compareRoutes({ ...base, quantity: 1e9 }).best).toBeNull();
  expect(compareRoutes({ ...base, slippage: NaN }).best).toBeNull();
});

test("a worst-level price limit cannot be passed merely because average fill is cheaper", () => {
  const result = compareRoutes({
    ...base,
    allowed: ["pacifica"],
    slippage: 0.01,
  });
  const candidate = result.candidates[0];
  expect(candidate.quote!.averageFill / result.reference - 1).toBeLessThan(
    0.0001,
  );
  expect(candidate.reason).toBe("Exceeds slippage limit");
});

test("invalid numbers never become eligible and exact depth is handled", () => {
  for (const size of [NaN, Infinity, -1, 0])
    expect(compareRoutes({ ...base, quantity: size }).best).toBeNull();
  for (const value of ["", "-1", "Infinity", "1e3", "a", "1.2.3"])
    expect(Number.isNaN(parseAmount(value))).toBe(true);
  expect(parseAmount("0.25")).toBe(0.25);
  const depth = fixtureBook("BTC", "velocity", "Buy", "balanced").reduce(
    (sum, l) => sum + l.quantity,
    0,
  );
  expect(
    quoteVenue("BTC", "velocity", "Buy", depth, "balanced"),
  ).not.toBeNull();
  expect(
    quoteVenue("BTC", "velocity", "Buy", depth + 0.001, "balanced"),
  ).toBeNull();
});

test("equivalent reference notionals produce consistent BTC and SOL cost rankings", () => {
  const sol = compareRoutes(base);
  const btc = compareRoutes({
    ...base,
    market: "BTC",
    quantity: 10000 / 61800,
  });
  expect(sol.best?.venue).toBe(btc.best?.venue);
  for (let i = 0; i < sol.ranked.length; i++)
    expect(sol.ranked[i].totalCost).toBeCloseTo(btc.ranked[i].totalCost, 7);
});

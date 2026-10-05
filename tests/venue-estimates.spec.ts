import { expect, test } from "@playwright/test";
import { walkBook } from "../src/components/demo/live-routing";
import {
  entryCostBreakdown,
  formatCostBps,
  orderVenueEstimates,
} from "../src/components/demo/venue-estimates";
import type { Candidate, Quote } from "../src/components/demo/routing";
import type { LiveVenue } from "../src/components/demo/market-data/adapters";

function quote(venue: LiveVenue, levels: [number, number][], feeBps: number) {
  return walkBook(
    venue,
    {
      time: Date.now(),
      bids: [{ price: 200 - levels[0][0], size: 100 }],
      asks: levels.map(([price, size]) => ({ price, size })),
    },
    "Buy",
    100,
    feeBps,
  )!;
}

const quotes = [
  quote(
    "pacifica",
    [
      [100.02, 40],
      [100.08, 60],
    ],
    4,
  ),
  quote(
    "bulk",
    [
      [100.04, 70],
      [100.05, 30],
    ],
    3.5,
  ),
  quote(
    "phoenix",
    [
      [100.01, 20],
      [100.12, 80],
    ],
    3.5,
  ),
];

test("bps components use the venue midpoint notional, not the published fee rate", () => {
  const q = quotes[0];
  const costs = entryCostBreakdown(q)!;
  expect(costs.priceBps).toBeCloseTo(5.6, 10);
  expect(costs.feeBps).toBeCloseTo(4.00224, 10);
  expect(costs.totalBps).toBeCloseTo(9.60224, 10);
  expect(costs.priceBps + costs.feeBps).toBeCloseTo(q.costBps, 10);
  expect(costs.feeBps).not.toBe(4);
  expect((q.quantity * 100 * costs.totalBps) / 10_000).toBeCloseTo(
    q.totalCost,
    10,
  );
});

test("sell spread and impact is positive even when that venue is above another benchmark", () => {
  const q = walkBook(
    "bulk",
    {
      time: Date.now(),
      bids: [
        { price: 100.04, size: 70 },
        { price: 100.03, size: 30 },
      ],
      asks: [{ price: 100.05, size: 100 }],
    },
    "Sell",
    100,
    3.5,
  )!;
  const costs = entryCostBreakdown(q)!;
  expect(q.reference).toBe(100.045);
  expect(costs.priceBps).toBeCloseTo(0.799640162, 8);
  expect(costs.feeBps).toBeCloseTo(3.499720126, 8);
  expect(costs.totalBps).toBeCloseTo(4.299360288, 8);
  expect(costs.priceBps + costs.feeBps).toBeCloseTo(q.costBps, 10);
});

test("eligible venues sort by unrounded entry cost without mutating candidates", () => {
  const candidates: Candidate[] = quotes.map((q) => ({
    venue: q.venue,
    quote: q,
    reason: null,
  }));
  const original = [...candidates];
  const sorted = orderVenueEstimates(candidates);
  expect(sorted.map((c) => c.venue)).toEqual(["bulk", "pacifica", "phoenix"]);
  expect(candidates).toEqual(original);
  expect(sorted).not.toBe(candidates);
  const close: Candidate[] = [
    {
      venue: "pacifica",
      quote: { ...quotes[0], costBps: 1.004 },
      reason: null,
    },
    { venue: "bulk", quote: { ...quotes[1], costBps: 1.003 }, reason: null },
  ];
  expect(orderVenueEstimates(close)[0].venue).toBe("bulk");
  expect(formatCostBps(close[0].quote!.costBps)).toBe(
    formatCostBps(close[1].quote!.costBps),
  );
});

test("delayed, excluded, missing and non-finite quotes follow eligible rows in stable order", () => {
  const candidates: Candidate[] = [
    {
      venue: "phoenix",
      quote: { ...quotes[2], costBps: -100 },
      reason: "Stale book",
    },
    { venue: "pacifica", quote: quotes[0], reason: null },
    { venue: "bulk", quote: quotes[1], reason: null },
    { venue: "velocity", quote: null, reason: "Loading venue fees" },
  ];
  expect(orderVenueEstimates(candidates).map((c) => c.venue)).toEqual([
    "bulk",
    "pacifica",
    "phoenix",
    "velocity",
  ]);
  candidates[2].reason = "Excluded in preferences";
  expect(orderVenueEstimates(candidates).map((c) => c.venue)).toEqual([
    "pacifica",
    "phoenix",
    "bulk",
    "velocity",
  ]);
  candidates[2].reason = null;
  candidates[2].quote = { ...quotes[1], costBps: NaN };
  expect(orderVenueEstimates(candidates).map((c) => c.venue)).toEqual([
    "pacifica",
    "phoenix",
    "bulk",
    "velocity",
  ]);
});

test("lower costs rank first and exact ties retain venue order", () => {
  const candidates: Candidate[] = quotes.map((q) => ({
    venue: q.venue,
    quote: { ...q, costBps: q.venue === "pacifica" ? 2 : 1 },
    reason: null,
  }));
  expect(orderVenueEstimates(candidates).map((c) => c.venue)).toEqual([
    "bulk",
    "phoenix",
    "pacifica",
  ]);
  expect(
    orderVenueEstimates([...candidates].reverse()).map((c) => c.venue),
  ).toEqual(["phoenix", "bulk", "pacifica"]);
});

test("invalid basis values are unavailable, and display rounding avoids negative zero", () => {
  for (const reference of [0, -100, NaN, Infinity])
    expect(entryCostBreakdown({ ...quotes[0], reference })).toBeNull();
  for (const field of ["priceCost", "venueFee", "costBps"] as const)
    expect(
      entryCostBreakdown({ ...quotes[0], [field]: NaN } as Quote),
    ).toBeNull();
  expect(formatCostBps(-0.004)).toBe("0.00");
  expect(formatCostBps(-0.005)).toBe("-0.01");
  expect(formatCostBps(1234.567)).toBe("1,234.57");
  expect(formatCostBps(NaN)).toBe("—");
});

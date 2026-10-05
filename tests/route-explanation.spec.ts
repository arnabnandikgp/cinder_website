import { mockWallet, connectWallet } from "./helpers/wallet";
import { expect, test } from "@playwright/test";
import { explainRoute } from "../src/components/demo/route-explanation";
import {
  compareRoutes,
  type Quote,
  type RouteComparison,
} from "../src/components/demo/routing";
import type { LiveComparisonMeta } from "../src/components/demo/live-routing";
import { mockMarketData } from "./helpers/market-data";

const seed = compareRoutes({
  market: "SOL",
  side: "Buy",
  quantity: 2,
  leverage: 25,
  slippage: 5,
  allowed: ["pacifica", "bulk"],
  snapshot: "balanced",
  account: "funded",
});
function quote(venue: Quote["venue"], priceCost: number, fees: number): Quote {
  return {
    ...seed.ranked[0],
    venue,
    quantity: 2,
    priceCost,
    venueFee: fees,
    totalFees: fees,
    totalCost: priceCost + fees,
    cinderFee: 0,
  };
}
function comparison(best: Quote, next?: Quote): RouteComparison {
  const ranked = [best, ...(next ? [next] : [])];
  return {
    ...seed,
    best,
    ranked,
    savings: next ? next.totalCost - best.totalCost : null,
    candidates: ranked.map((q) => ({ venue: q.venue, quote: q, reason: null })),
  };
}

test.beforeEach(async ({ page }) => {
  await mockWallet(page);
});

for (const [a, b, expected] of [
  [[1, 2], [4, 1], "spread and depth impact outweighs the higher fee"],
  [[2, 1], [1, 4], "Lower fees outweigh the higher spread and depth impact"],
  [[1, 1], [2, 2], "spread and depth impact and lower fees"],
  [[1, 1], [2, 1], "spread and depth impact at similar fees"],
  [[1, 1], [1, 2], "Lower fees at similar spread and depth impact"],
] as const) {
  test(`live explanation distinguishes ${expected}`, () => {
    const result = explainRoute(
      comparison(quote("pacifica", a[0], a[1]), quote("bulk", b[0], b[1])),
    );
    expect(result.text).toContain(expected);
    expect(result.text).toContain("BULK");
    expect(
      result.against!.priceAdvantage + result.against!.feeAdvantage,
    ).toBeCloseTo(result.against!.saving);
    expect(result.against!.saving).toBeCloseTo(b[0] + b[1] - (a[0] + a[1]));
  });
}

test("sell-side explanations are side-neutral and never call a lower sell price better", () => {
  const value = comparison(quote("bulk", 1, 1), quote("pacifica", 3, 1));
  value.input.side = "Sell";
  expect(explainRoute(value).text).toContain("spread and depth impact");
  expect(explainRoute(value).text).not.toContain("lower fill price");
});

test("similar estimates, missing alternatives and no winner do not invent an advantage", () => {
  const value = comparison(quote("pacifica", 1, 1), quote("bulk", 1.005, 1));
  value.live = { tied: true } as LiveComparisonMeta;
  expect(explainRoute(value)).toEqual({
    text: "Costs are similar; there is no clear cost advantage.",
    against: null,
  });
  const one = comparison(quote("bulk", 1, 1));
  one.candidates.push({
    venue: "phoenix",
    quote: quote("phoenix", -10, 1),
    reason: "Stale book",
  });
  expect(explainRoute(one).text).toContain("Only one complete estimate");
  expect(explainRoute(one).against).toBeNull();
  expect(explainRoute({ ...one, best: null }).against).toBeNull();
  expect(explainRoute({ ...one, best: null }).text).toContain(
    "No complete eligible estimate",
  );
});

test("rounding-resolution differences do not fabricate a meaningful fee advantage", () => {
  const value = comparison(quote("pacifica", 1, 1), quote("bulk", 2, 1.00001));
  expect(explainRoute(value).text).toContain("similar fees");
  const invalid = comparison(quote("pacifica", NaN, 1), quote("bulk", 2, 1));
  expect(explainRoute(invalid).against).toBeNull();
});

test("compact Pro shows cost drivers without a hidden breakdown", async ({
  page,
}) => {
  await mockMarketData(page, { stream: true, phoenix: true });
  await page.goto("/demo?mode=auto&analysis=average");
  await connectWallet(page);
  await expect(page.getByTestId("recommended-venue")).toHaveText("BULK");
  const card = page.getByTestId("route-card");
  await expect(card.locator("details")).toHaveCount(0);
  for (const label of [
    "Execution cost",
    "Average fill",
    "Effective price",
    "Spread & impact",
    "Venue fee rate",
  ])
    await expect(card).toContainText(label);
  await page.getByRole("radio", { name: "Sell / Short" }).check();
  await expect(page.getByTestId("recommended-venue")).toHaveText("BULK");
  await page.getByRole("button", { name: /Allowed venues:/ }).click();
  await page.getByRole("checkbox", { name: "Pacifica" }).uncheck();
  await page.getByRole("checkbox", { name: "Phoenix" }).uncheck();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(card).toContainText("Only available estimate");
  await expect(page.locator(".d-route-saving")).toHaveCount(0);
});

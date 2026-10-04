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

for (const [a, b, expected] of [
  [[1, 2], [4, 1], "better fill price outweighs the higher fee"],
  [[2, 1], [1, 4], "Lower fees outweigh the higher price cost"],
  [[1, 1], [2, 2], "better fill price and lower fees"],
  [[1, 1], [2, 1], "better fill price at similar fees"],
  [[1, 1], [1, 2], "Lower fees at a similar price cost"],
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
  const value = comparison(quote("bulk", -3, 1), quote("pacifica", -1, 1));
  value.input.side = "Sell";
  expect(explainRoute(value).text).toContain("better fill price");
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

test("Pro exposes its actual live cost driver and reconciled contributions", async ({
  page,
}) => {
  await mockMarketData(page, { stream: true, phoenix: true });
  await page.goto("/demo?mode=auto&analysis=average");
  const reason = page.getByTestId("route-reason");
  await expect(page.getByTestId("recommended-venue")).toHaveText("Pacifica");
  await expect(reason).toContainText(
    "better fill price and lower fees versus Phoenix",
  );
  const breakdown = page.locator(".d-route-breakdown");
  await breakdown.locator("summary").click();
  await expect(breakdown).toContainText("Advantage vs Phoenix");
  const values = await breakdown
    .locator(".d-route-reason-detail dd")
    .allTextContents();
  const dollars = values.map((value) =>
    Number(value.replace(/[$+,]/g, "").replace("−", "-")),
  );
  expect(dollars[0]).toBeGreaterThan(0);
  expect(dollars[1]).toBeGreaterThan(0);
  expect(Math.abs(dollars[0] + dollars[1] - dollars[2])).toBeLessThanOrEqual(
    0.011,
  );
  await page.getByRole("radio", { name: "Sell / Short" }).check();
  await expect(page.getByTestId("recommended-venue")).toHaveText("BULK");
  await expect(reason).toContainText("better fill price");
  await expect(reason).not.toContainText("lower fill price");
  await page.getByRole("button", { name: /Allowed venues:/ }).click();
  await page.getByRole("checkbox", { name: "Pacifica" }).uncheck();
  await page.getByRole("checkbox", { name: "Phoenix" }).uncheck();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(reason).toContainText("Only one complete estimate");
  await expect(page.locator(".d-route-reason-detail")).toHaveCount(0);
});

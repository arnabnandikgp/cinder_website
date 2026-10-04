import { expect, test } from "@playwright/test";
import { mockMarketData } from "./helpers/market-data";

let marketData: Awaited<ReturnType<typeof mockMarketData>>;
test.beforeEach(async ({ page }) => {
  marketData = await mockMarketData(page, { stream: true, phoenix: true });
});

test("table shows bps contributions and total cost matching the plotted estimate", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo?mode=auto");
  await expect(page.getByTestId("comparison-status")).toContainText("3 venues");
  const table = page.getByLabel("Venue comparison table");
  await expect(table.locator(".d-entry-cost")).toHaveCount(3);
  await expect(table.getByRole("columnheader")).toHaveText([
    "Venue",
    "Price cost",
    "Fee cost",
    "Entry cost¹",
  ]);
  await expect(
    table.getByRole("columnheader", { name: "Entry cost¹" }),
  ).toHaveAttribute("aria-sort", "ascending");
  for (const venue of ["pacifica", "bulk", "phoenix"]) {
    const row = page.getByTestId(`route-row-${venue}`);
    const values = await row.locator(".d-cost-bps").allTextContents();
    expect(values).toHaveLength(3);
    expect(values.every((v) => v.includes("bps"))).toBe(true);
    const [price, fee, total] = values.map((v) =>
      Number(v.replace(/bps|,/g, "").trim()),
    );
    expect(Math.abs(price + fee - total)).toBeLessThanOrEqual(0.011);
    const unrounded = Number(
      await row.locator(".d-entry-cost").getAttribute("data-cost-bps"),
    );
    expect(Math.abs(total - unrounded)).toBeLessThanOrEqual(0.005);
    const dollars = Number(
      (
        await row.locator("td").last().locator(".d-cell-sub").innerText()
      ).replace(/[$,]/g, ""),
    );
    // At 10,000 USDC, each basis point corresponds to one dollar.
    expect(dollars).toBe(total);
  }
  await page.screenshot({
    path: "/private/tmp/cinder-pro-cost-bps-desktop.png",
  });
  await page.locator(".d-comparison-method summary").click();
  await expect(page.locator(".d-comparison-method")).toContainText(
    "same shared-reference order notional",
  );
  await expect(table).not.toContainText("Avg. fill");
  await expect(table).not.toContainText("Effective price");
});

test("buy and sell rows reorder cheapest first and keep the clear winner blue", async ({
  page,
}) => {
  await page.goto("/demo?mode=auto");
  await expect(page.getByTestId("curve-phoenix")).toHaveCount(1);
  const rows = page.locator(".d-comparison-table tbody tr");
  const assertRanked = async () => {
    const costs = await rows
      .locator(".d-entry-cost")
      .evaluateAll((els) =>
        els.map((el) => Number(el.getAttribute("data-cost-bps"))),
      );
    expect(costs).toHaveLength(3);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
    await expect(rows.first()).toHaveClass(/d-best-row/);
  };
  await expect(rows.locator("strong.d-venue-key")).toHaveText([
    "Pacifica",
    "Phoenix",
    "BULK",
  ]);
  await assertRanked();
  await page.getByRole("radio", { name: "Sell / Short" }).check();
  await expect(rows.locator("strong.d-venue-key")).toHaveText([
    "BULK",
    "Phoenix",
    "Pacifica",
  ]);
  await assertRanked();
  await expect(page.getByTestId("recommended-venue")).toHaveText("BULK");
});

test("a delayed cheap venue stays below fresh estimates and is never highlighted", async ({
  page,
}) => {
  await page.goto("/demo?mode=auto");
  await expect(page.getByTestId("curve-phoenix")).toHaveCount(1);
  const socket = marketData.sockets.find(
    (s) => s.venue === "pacifica" && !s.closed,
  )!;
  socket.paused = true;
  await expect(page.getByTestId("route-row-pacifica")).toContainText(
    "Delayed",
    { timeout: 4000 },
  );
  const rows = page.locator(".d-comparison-table tbody tr");
  await expect(rows.locator("strong.d-venue-key")).toHaveText([
    "Phoenix",
    "BULK",
    "Pacifica",
  ]);
  await expect(rows.first()).toHaveClass(/d-best-row/);
  await expect(page.getByTestId("route-row-pacifica")).not.toHaveClass(
    /d-best-row/,
  );
  await expect(
    page.getByTestId("route-row-pacifica").locator(".d-entry-cost"),
  ).toContainText("bps");
  await expect(page.getByTestId("recommended-venue")).toHaveText("Phoenix");
  socket.paused = false;
  await expect(rows.locator("strong.d-venue-key")).toHaveText([
    "Pacifica",
    "Phoenix",
    "BULK",
  ]);
});

test("incomplete and excluded estimates follow ranked venues without false blue winners", async ({
  page,
}) => {
  await page.goto("/demo?mode=auto");
  await expect(page.getByTestId("curve-phoenix")).toHaveCount(1);
  const rows = page.locator(".d-comparison-table tbody tr");
  await page
    .getByRole("button", { name: "Set order notional to 100000 USDC" })
    .click();
  await expect(rows.locator("strong.d-venue-key")).toHaveText([
    "BULK",
    "Pacifica",
    "Phoenix",
  ]);
  await expect(page.getByTestId("route-row-pacifica")).toContainText(
    "Insufficient visible depth",
  );
  await expect(rows.filter({ has: page.locator(".d-entry-cost") })).toHaveCount(
    1,
  );
  await expect(page.locator(".d-best-row")).toHaveCount(0);
  await page.getByLabel("Order size", { exact: true }).fill("10000");
  await page.getByRole("button", { name: /Allowed venues/ }).click();
  await page.getByRole("checkbox", { name: "Pacifica" }).uncheck();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(rows.locator("strong.d-venue-key")).toHaveText([
    "Phoenix",
    "BULK",
    "Pacifica",
  ]);
  await expect(page.getByTestId("route-row-pacifica")).toContainText(
    "Excluded in preferences",
  );
  await expect(
    page.getByTestId("route-row-pacifica").locator(".d-entry-cost"),
  ).toHaveCount(0);
});

test("near ties are sorted but do not imply a clear cheapest venue", async ({
  page,
}) => {
  await page.goto("/demo?mode=auto&market=BTC");
  await expect(page.getByTestId("curve-phoenix")).toHaveCount(1);
  await expect(page.getByTestId("route-row-pacifica")).toContainText(
    "Similar estimate",
  );
  const rows = page.locator(".d-comparison-table tbody tr");
  const costs = await rows
    .locator(".d-entry-cost")
    .evaluateAll((els) =>
      els.map((el) => Number(el.getAttribute("data-cost-bps"))),
    );
  expect(costs).toEqual([...costs].sort((a, b) => a - b));
  await expect(page.locator(".d-best-row")).toHaveCount(0);
  await expect(page.locator(".d-route-saving")).toHaveCount(0);
});

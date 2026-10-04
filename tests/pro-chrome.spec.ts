import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockMarketData } from "./helpers/market-data";
import { chooseVenue } from "./helpers/venue-select";

test.beforeEach(async ({ page }) => {
  await mockMarketData(page, { stream: true, phoenix: true });
});

test("Pro shares the branded instrument across cost and price views", async ({
  page,
}) => {
  await page.goto("/demo?mode=auto");
  const market = page.getByRole("combobox", { name: "Market", exact: true });
  await expect(market).toHaveCount(1);
  await expect(market.locator("option:checked")).toHaveText("SOL-USDC");
  await expect(page.locator(".d-pro-heading .d-asset-icon")).toHaveAttribute(
    "src",
    "/brand/assets/sol.svg",
  );
  await expect(page.locator(".d-pro-heading .d-leverage-badge")).toHaveText(
    "25x",
  );
  await page.getByLabel("Leverage", { exact: true }).selectOption("10");
  await expect(page.locator(".d-pro-heading .d-leverage-badge")).toHaveText(
    "10x",
  );
  await market.selectOption("BTC");
  await expect(page.locator(".d-pro-heading .d-asset-icon")).toHaveAttribute(
    "src",
    "/brand/assets/btc.svg",
  );
  await page.getByRole("tab", { name: "Price chart", exact: true }).click();
  await expect(market).toHaveCount(1);
  await expect(market.locator("option:checked")).toHaveText("BTC-USDC");
  await expect(page.getByLabel("Market chart")).toHaveAttribute(
    "data-instrument",
    "hidden",
  );
  await chooseVenue(page, "Chart source", "phoenix");
  await expect(page.getByTestId("candle-status")).toHaveText("Live candles");
  await market.selectOption("SOL");
  await expect(page.locator(".d-pro-heading .d-asset-icon")).toHaveAttribute(
    "src",
    "/brand/assets/sol.svg",
  );
  await expect(page.getByTestId("candle-status")).toHaveText("Live candles");
});

test("quick sizes expose selection and chart range never changes order intent or ranking", async ({
  page,
}) => {
  await page.goto("/demo?mode=auto");
  await expect(page.getByTestId("curve-phoenix")).toHaveCount(1);
  const presets = page.getByRole("group", {
    name: "Order notional presets",
    exact: true,
  });
  await expect(presets.getByRole("button")).toHaveCount(3);
  await expect(presets.getByRole("button", { pressed: true })).toHaveCount(0);
  const preset = presets.getByRole("button", {
    name: "Set order notional to 5000 USDC",
  });
  await preset.focus();
  await page.keyboard.press("Enter");
  await expect(preset).toHaveAttribute("aria-pressed", "true");
  const size = page.getByLabel("Order size", { exact: true });
  await expect(size).toHaveValue("5000");
  await size.fill("300");
  await expect(presets.getByRole("button", { pressed: true })).toHaveCount(0);
  const plot = page.locator(".d-cost-svg");
  await expect(plot).toHaveAttribute("data-chart-max", "1000");
  await expect(page.getByTestId("order-size-marker")).toHaveCount(1);
  const winner = await page.getByTestId("recommended-venue").innerText();
  await page.getByRole("button", { name: "Full range", exact: true }).click();
  await expect(plot).toHaveAttribute("data-chart-range", "depth");
  expect(Number(await plot.getAttribute("data-chart-max"))).toBeGreaterThan(
    1000,
  );
  await expect(size).toHaveValue("300");
  await expect(page.getByTestId("recommended-venue")).toHaveText(winner);
  await page.getByRole("button", { name: "Order range", exact: true }).click();
  await expect(plot).toHaveAttribute("data-chart-max", "1000");
  await expect(page.getByTestId("recommended-venue")).toHaveText(winner);
  for (const venue of ["pacifica", "bulk", "phoenix"])
    await expect(
      page.getByTestId(`route-row-${venue}`).locator(".d-venue-icon"),
    ).toBeVisible();
});

test("price chart remains bounded after desktop-to-mobile resizing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo?mode=auto");
  await expect(page.getByTestId("curve-phoenix")).toHaveCount(1);
  await page.getByRole("tab", { name: "Price chart", exact: true }).click();
  await expect(page.locator(".d-tv-chart")).toHaveAttribute(
    "data-chart-status",
    "ready",
  );
  for (const [width, height] of [
    [375, 900],
    [1280, 720],
    [768, 900],
    [1440, 1000],
  ]) {
    await page.setViewportSize({ width, height });
    await expect
      .poll(
        async () =>
          (await page.locator(".d-pro-content").boundingBox())!.height,
      )
      .toBeLessThan(900);
    const panel = (await page.locator(".d-pro-content").boundingBox())!;
    const caption = (await page
      .locator(".d-price-chart-caption")
      .boundingBox())!;
    expect(caption.y + caption.height).toBeLessThanOrEqual(
      panel.y + panel.height + 1,
    );
    expect(
      (await page.locator(".d-chart-frame").boundingBox())!.height,
    ).toBeGreaterThanOrEqual(100);
    await expect(page.locator(".d-instrument")).toHaveCount(1);
  }
});

for (const [width, height] of [
  [375, 900],
  [768, 900],
  [1001, 800],
  [1280, 720],
  [1440, 1000],
  [1920, 1080],
]) {
  test(`polished Pro views fit at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/demo?mode=auto");
    await expect(page.getByTestId("curve-phoenix")).toHaveCount(1);
    const header = page.locator(".d-pro-heading");
    const plot = page.locator(".d-cost-svg");
    const headerBounds = (await header.boundingBox())!;
    for (const control of [
      page.getByLabel("Market", { exact: true }),
      page.getByRole("tab", { name: "Execution cost", exact: true }),
      page.getByTestId("comparison-status"),
    ]) {
      const box = (await control.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(headerBounds.x);
      expect(box.x + box.width).toBeLessThanOrEqual(
        headerBounds.x + headerBounds.width + 1,
      );
      expect(box.y + box.height).toBeLessThanOrEqual(
        headerBounds.y + headerBounds.height + 1,
      );
    }
    expect((await plot.boundingBox())!.height).toBeGreaterThanOrEqual(200);
    if (width === 1440 || width === 1920) {
      const graph = (await page.locator(".d-cost-plot").boundingBox())!;
      const table = (await page
        .getByLabel("Venue comparison table")
        .boundingBox())!;
      expect(table.x).toBeGreaterThanOrEqual(graph.x + graph.width - 1);
      expect((await plot.boundingBox())!.height).toBeGreaterThan(300);
    }
    if (width === 375)
      for (const button of await page
        .getByRole("group", { name: "Order notional presets" })
        .getByRole("button")
        .all())
        expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    for (const view of ["Execution cost", "Price chart"]) {
      await page.getByRole("tab", { name: view, exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width >= 768)
        expect(
          await page.evaluate(() => document.documentElement.scrollHeight),
        ).toBe(height);
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        audit.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ).toEqual([]);
    }
  });
}

import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bookMessage, mockMarketData } from "./helpers/market-data";

let marketData: Awaited<ReturnType<typeof mockMarketData>>;

test.beforeEach(async ({ page }) => {
  marketData = await mockMarketData(page, { stream: true });
});

test("Pro compares exact sizes, changes direction and excludes stale venues", async ({
  page,
}) => {
  await page.goto("/demo?mode=auto");
  await expect(
    page.getByRole("radio", { name: "Pro", exact: true }),
  ).toBeChecked();
  await expect(page.getByLabel("Execution venue", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.locator(".d-book")).toHaveCount(0);
  await expect(page.getByTestId("recommended-venue")).toHaveText("Pacifica");
  await expect(page.locator(".d-field-size .d-amount-input > span")).toHaveText(
    "USDC",
  );
  await expect(page.locator(".d-cost-heading h2")).toContainText(
    "10,000.00 USDC",
  );
  await page
    .getByRole("button", { name: "Set order notional to 100000 USDC" })
    .click();
  await expect(page.getByLabel("Order size", { exact: true })).toHaveValue(
    "100000",
  );
  await expect(page.locator(".d-cost-heading h2")).toContainText(
    "100,000.00 USDC",
  );
  await expect(page.getByTestId("recommended-venue")).toHaveText("BULK");
  await expect(page.getByTestId("route-row-pacifica")).toContainText(
    "Insufficient visible depth",
  );
  marketData.sockets.find((s) => s.venue === "bulk" && !s.closed)!.paused =
    true;
  await page.getByLabel("Order size", { exact: true }).fill("10000");
  await expect(page.getByTestId("recommended-venue")).toHaveText("Pacifica");
  await expect(page.getByTestId("route-row-bulk")).toContainText("Stale book");
  await expect(page.getByTestId("curve-bulk")).toHaveCount(0);
  await expect(page.locator(".d-route-saving")).toHaveCount(0);
  marketData.sockets.find((s) => s.venue === "bulk" && !s.closed)!.paused =
    false;
  await page.getByLabel("Order size", { exact: true }).fill("10000");
  await page.getByRole("radio", { name: "Sell / Short" }).check();
  await expect(page.getByTestId("recommended-venue")).toHaveText("BULK");
  await expect(
    page.getByRole("button", { name: "Review sell order" }),
  ).toHaveClass(/d-sell-action/);
  await page.getByLabel("Price tolerance").fill("0");
  await expect(page.getByTestId("recommended-venue")).toHaveText("No estimate");
  await expect(
    page.getByRole("button", { name: "Review sell order" }),
  ).toBeDisabled();
});

test("visibility does not change routing and Standard retains its instruction", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(page.getByTestId("book-status")).toHaveText("Live");
  await page.getByLabel("Execution venue").selectOption("bulk");
  await expect(page).toHaveURL(/venue=bulk/);
  await page.getByLabel("Order size", { exact: true }).fill("10000");
  await page.getByRole("radio", { name: "Pro", exact: true }).check();
  await expect(page.getByTestId("recommended-venue")).toHaveText("Pacifica");
  await page.getByRole("button", { name: "Show Pacifica curve" }).click();
  await expect(page.getByTestId("curve-pacifica")).toHaveCount(0);
  await expect(page.getByTestId("recommended-venue")).toHaveText("Pacifica");
  await page.getByRole("button", { name: /Allowed venues/ }).click();
  await page.getByRole("checkbox", { name: "Pacifica" }).uncheck();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByTestId("recommended-venue")).toHaveText("BULK");
  await page.getByRole("radio", { name: "Standard", exact: true }).check();
  await expect(page.getByLabel("Execution venue")).toHaveValue("bulk");
  await expect(page.getByLabel("Order size", { exact: true })).toHaveValue(
    "10000",
  );
  await expect(
    page.getByRole("radio", { name: "Limit", exact: true }),
  ).toBeChecked();
  await expect(page.getByTestId("manual-chart-source")).toHaveText("BULK");
});

test("route review preserves its breakdown in Activity after market inputs change", async ({
  page,
}) => {
  await page.goto("/demo?mode=auto");
  await page.getByRole("button", { name: "Review buy order" }).click();
  const dialog = page.getByRole("dialog");
  const receipt = dialog.getByRole("region", { name: "Saved route estimate" });
  const original = await receipt.innerText();
  await expect(receipt).toContainText("Pacifica");
  await expect(receipt).toContainText("No fills or fees were booked");
  await expect(receipt).toContainText("10,000.00 USDC");
  await dialog.getByRole("button", { name: "Save example draft" }).click();
  await page.getByLabel("Order size", { exact: true }).fill("100000");
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page.locator(".d-events")).toContainText("Pro route: Pacifica");
  await page.getByRole("button", { name: "DRAFT-1 · View details" }).click();
  expect(await receipt.innerText()).toBe(original);
  await expect(dialog).toContainText("Not submitted");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Trade", exact: true }).click();
  await expect(page.getByLabel("Order size", { exact: true })).toHaveValue(
    "100000",
  );
});

test("price chart remains independent and view comparison restores the cost table", async ({
  page,
}) => {
  await page.goto("/demo?mode=auto");
  await expect(page.getByTestId("recommended-venue")).toHaveText("Pacifica");
  const best = await page.getByTestId("recommended-venue").innerText();
  await page.getByRole("tab", { name: "Execution cost", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Price chart", exact: true }),
  ).toBeFocused();
  await page.getByLabel("Chart source").selectOption("bulk");
  await expect(page.locator(".d-tv-chart")).toHaveAttribute(
    "data-chart-key",
    "SOL-bulk-15m",
  );
  await expect(page.getByTestId("recommended-venue")).toHaveText(best);
  await page
    .getByRole("button", { name: "View comparison", exact: true })
    .click();
  await expect(page.locator("#d-route-comparison")).toBeFocused();
  await expect(
    page.getByRole("tab", { name: "Execution cost", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});

test("live Pro fetches public fees, keeps depth gaps honest and stops feeds on Account", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url());
  });
  await page.goto("/demo?mode=auto");
  await expect(page.getByTestId("comparison-status")).toContainText(
    "Live books · 2 venues",
  );
  await expect(page.getByLabel("Market snapshot")).toHaveCount(0);
  await expect(page.getByTestId("route-row-velocity")).toHaveCount(0);
  expect(marketData.requests.some((url) => url.includes("/info/fees"))).toBe(
    true,
  );
  expect(marketData.requests.some((url) => url.includes("/feeState"))).toBe(
    true,
  );
  expect(marketData.requests.some((url) => url.includes("kline"))).toBe(false);
  await page.locator(".d-comparison-method summary").click();
  await expect(page.locator(".d-comparison-method")).toContainText(
    "Public tier 0: 4.00 bps",
  );
  await expect(page.locator(".d-comparison-method")).toContainText("0.5 bps");
  await page
    .getByRole("button", { name: "Set order notional to 100000 USDC" })
    .click();
  await expect(page.getByTestId("recommended-venue")).toHaveText("BULK");
  await expect(page.getByTestId("route-row-pacifica")).toContainText(
    "Insufficient visible depth",
  );
  await expect(page.locator(".d-route-saving")).toHaveCount(0);
  await page.getByLabel("Order size", { exact: true }).fill("1000000");
  await expect(page.getByTestId("recommended-venue")).toHaveText("No estimate");
  await expect(
    page.getByRole("button", { name: "Review buy order" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect
    .poll(() => marketData.sockets.filter((s) => !s.closed).length)
    .toBe(0);
  expect(writes).toEqual([]);
});

test("missing fees do not become a zero fee and reconnection restores comparisons", async ({
  page,
}) => {
  await page.route("**/api/v1/feeState", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto("/demo?mode=auto");
  await expect(page.getByTestId("route-row-bulk")).toContainText(
    "Fee schedule unavailable",
  );
  await expect(page.getByTestId("recommended-venue")).toHaveText("Pacifica");
  await expect(page.locator(".d-route-saving")).toHaveCount(0);
  await page.unroute("**/api/v1/feeState");
  await page.getByRole("button", { name: "Reconnect feeds" }).click();
  await expect(page.getByTestId("comparison-status")).toContainText(
    "Live books · 2 venues",
  );
});

test("out-of-sync books withhold rankings and neither chart nor ticket uses fixture prices", async ({
  page,
}) => {
  await page.goto("/demo?mode=auto");
  await expect(page.getByTestId("comparison-status")).toContainText(
    "Live books · 2 venues",
  );
  for (const socket of marketData.sockets) socket.paused = true;
  // Wait for the previously received BULK source time to become older, so this
  // is a valid advancing timestamp, not a time regression ignored by the feed.
  await expect(page.getByTestId("comparison-status")).toContainText(
    "Waiting for fresh venue data",
    { timeout: 5000 },
  );
  const now = Date.now();
  marketData.sockets
    .find((s) => s.venue === "pacifica" && !s.closed)!
    .socket.send(JSON.stringify(bookMessage("pacifica", "SOL", 152, now)));
  marketData.sockets
    .find((s) => s.venue === "bulk" && !s.closed)!
    .socket.send(
      JSON.stringify(bookMessage("bulk", "SOL", 153, now - 1200, true)),
    );
  await expect(page.getByTestId("comparison-status")).toContainText(
    "Waiting for aligned books",
  );
  await expect(page.getByTestId("recommended-venue")).toHaveText("No estimate");
  await expect(page.locator(".d-cost-line")).toHaveCount(0);
  await expect(page.locator(".d-cost-heading")).not.toContainText("NaN");
});

for (const [width, height] of [
  [375, 900],
  [768, 900],
  [1280, 720],
  [1440, 1000],
]) {
  test(`Pro is accessible and contained at ${width}×${height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/demo?mode=auto");
    await expect(page.getByTestId("recommended-venue")).toHaveText("Pacifica");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width >= 768) {
      expect(
        await page.evaluate(() => document.documentElement.scrollHeight),
      ).toBe(height);
      for (const name of [".d-pro-workspace", ".d-ticket", ".d-records"]) {
        const box = await page.locator(name).boundingBox();
        expect(box!.y + box!.height).toBeLessThanOrEqual(height);
      }
    }
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath("pro-workspace.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Review buy order" }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "Total estimated entry cost",
    );
    await page.keyboard.press("Escape");
    expect(errors).toEqual([]);
  });
}

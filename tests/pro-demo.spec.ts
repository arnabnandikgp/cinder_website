import { expect, test } from "@playwright/test";
import { chooseVenue } from "./helpers/venue-select";
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
  await expect(page.getByTestId("route-row-bulk")).toContainText("Delayed");
  await expect(page.getByTestId("curve-bulk")).toHaveCount(0);
  await expect(page.getByTestId("delayed-curve-bulk")).toHaveCount(1);
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
  await chooseVenue(page, "Execution venue", "bulk");
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
  await expect(page.getByLabel("Execution venue")).toHaveAttribute(
    "data-value",
    "bulk",
  );
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
  await chooseVenue(page, "Chart source", "bulk");
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
  await expect(page.locator(".d-cost-line:not(.is-delayed)")).toHaveCount(0);
  await expect(page.locator(".d-plot-caption")).toContainText(
    "excluded from recommendation",
  );
  await expect(page.locator(".d-cost-heading")).not.toContainText("NaN");
});

test("mixed feed cadence and Pacifica source lag do not blank healthy comparisons", async ({
  page,
}) => {
  await page.unrouteAll({ behavior: "wait" });
  marketData = await mockMarketData(page, {
    stream: true,
    phoenix: true,
    bookCadenceMs: { phoenix: 1500 },
    sourceLagMs: { pacifica: 1400 },
  });
  await page.goto("/demo?mode=auto");
  await expect(page.getByTestId("comparison-status")).toContainText(
    "Live books",
  );
  // Cover several whole-second boundaries and independently arriving frames.
  // Feed health can arrive before the first common analytical publication.
  await expect
    .poll(() => page.locator(".d-cost-line:not(.is-delayed)").count())
    .toBeGreaterThanOrEqual(2);
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => ({
      status: document.querySelector("[data-testid=comparison-status]")
        ?.textContent,
      curves: document.querySelectorAll(".d-cost-line").length,
      freshCurves: document.querySelectorAll(".d-cost-line:not(.is-delayed)")
        .length,
      rows: [
        ...document.querySelectorAll(
          "[data-testid^=route-row-] strong.d-venue-key",
        ),
      ].map((el) => el.textContent),
    }));
    expect(state.status).toContain("Live books");
    expect(state.curves).toBeGreaterThanOrEqual(2);
    // A one-second publication can still mark an older cohort member delayed
    // while newer feeds recover. Keep that observation visible, not falsely
    // fresh or blank, until the next synchronized frame.
    expect(state.freshCurves).toBeGreaterThanOrEqual(1);
    expect([...state.rows].sort()).toEqual(["BULK", "Pacifica", "Phoenix"]);
    await page.waitForTimeout(100);
  }
});

test("a quiet Phoenix remains visibly delayed without entering recommendations, then expires and recovers", async ({
  page,
}) => {
  await page.unrouteAll({ behavior: "wait" });
  marketData = await mockMarketData(page, { stream: true, phoenix: true });
  await page.goto("/demo?mode=auto");
  await expect(page.getByTestId("comparison-status")).toContainText(
    "Live books · 3 venues",
  );
  const socket = marketData.sockets.find(
    (s) => s.venue === "phoenix" && !s.closed,
  )!;
  socket.paused = true;
  await expect(page.getByTestId("route-row-phoenix")).toContainText("Delayed", {
    timeout: 4000,
  });
  await expect(page.getByTestId("delayed-curve-phoenix")).toHaveCount(1);
  await expect(page.getByTestId("comparison-status")).toContainText(
    "Live books · 2 venues",
  );
  await expect(page.getByTestId("route-row-phoenix")).not.toHaveClass(
    /d-best-row/,
  );
  await expect(page.getByTestId("route-row-phoenix")).toContainText("$");
  await expect(page.getByTestId("delayed-curve-phoenix")).toHaveCount(0, {
    timeout: 11000,
  });
  await expect(page.getByTestId("route-row-phoenix")).toContainText(
    "Stale book",
  );
  await expect(page.getByTestId("curve-pacifica")).toHaveCount(1);
  await expect(page.getByTestId("curve-bulk")).toHaveCount(1);
  socket.paused = false;
  await expect(page.getByTestId("curve-phoenix")).toHaveCount(1);
  await expect(page.getByTestId("route-row-phoenix")).not.toContainText(
    "Delayed",
  );
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

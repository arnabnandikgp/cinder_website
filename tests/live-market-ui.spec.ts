import { expect, test } from "@playwright/test";
import { chooseVenue } from "./helpers/venue-select";
import AxeBuilder from "@axe-core/playwright";
import { bars, bookMessage, mockMarketData } from "./helpers/market-data";

test("a streamed candle arriving before REST history does not crash the chart", async ({
  page,
}) => {
  await mockMarketData(page);
  let releaseHistory: (() => void) | undefined;
  await page.route("**/api/v1/kline?**", async (route) => {
    await new Promise<void>((resolve) => {
      releaseHistory = resolve;
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: bars() }),
    });
  });
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/demo");
  const chart = page.locator(".d-tv-chart");
  await expect(chart).toHaveAttribute("data-candle-count", "1");
  await expect(chart).toHaveAttribute("data-chart-status", "ready");
  await expect.poll(() => Boolean(releaseHistory)).toBe(true);
  releaseHistory!();
  await expect(chart).toHaveAttribute("data-candle-count", "80");
  await expect(page.getByTestId("market-oracle")).toHaveText("151.95");
  expect(errors).toEqual([]);
});

test("oracle, funding and quote volume follow the execution venue with no additional subscriptions", async ({
  page,
}) => {
  const { sockets } = await mockMarketData(page);
  await page.goto("/demo");
  await expect(page.getByTestId("market-oracle")).toHaveText("151.95");
  await expect(page.getByTestId("market-funding")).toHaveText("−0.00215%");
  await expect(page.getByTestId("market-volume")).toHaveText("$12.3M");
  await expect(
    page.getByText("Est. funding · 1h", { exact: true }),
  ).toBeVisible();
  const details = page.getByLabel("Funding rate details", { exact: true });
  await details.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".d-funding-popover")).toBeVisible();
  await expect(page.locator(".d-funding-popover")).toContainText("+0.00125%");
  await expect(page.locator(".d-funding-popover")).toContainText(
    "shorts pay longs",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".d-funding-popover")).not.toBeVisible();
  await expect(details).toBeFocused();
  expect(sockets.filter((s) => !s.closed)).toHaveLength(1);
  expect(
    sockets
      .find((s) => !s.closed)!
      .messages.filter((m) => m.method === "subscribe"),
  ).toHaveLength(3);
  await chooseVenue(page, "Execution venue", "bulk");
  await expect(page.getByTestId("market-oracle")).toHaveText("152.90");
  await expect(page.getByTestId("market-funding")).toHaveText("+0.01%");
  await expect(page.getByTestId("market-volume")).toHaveText("$234.6M");
  await expect(
    page.getByText("Funding · venue", { exact: true }),
  ).toBeVisible();
  await details.click();
  await expect(page.locator(".d-funding-popover")).toContainText(
    "no hourly conversion or countdown",
  );
  await expect(page.locator(".d-funding-popover")).toContainText(
    "longs pay shorts",
  );
});

test("missing statistics clear old values, while zero and stale rates remain explicit", async ({
  page,
}) => {
  const { sockets } = await mockMarketData(page);
  await page.goto("/demo");
  await expect(page.getByTestId("ticker-status")).toHaveText("Live");
  const send = (row: Record<string, unknown>) =>
    sockets
      .find((s) => !s.closed)!
      .socket.send(
        JSON.stringify({
          channel: "prices",
          data: [{ symbol: "SOL", mark: 152, timestamp: Date.now(), ...row }],
        }),
      );
  send({ funding: 0, next_funding: 0, volume_24h: 0, oracle: 151 });
  await expect(page.getByTestId("market-funding")).toHaveText("0.00%");
  await expect(page.getByTestId("market-volume")).toHaveText("$0.00");
  await page.clock.install();
  await page.clock.fastForward(11000);
  await expect(page.getByTestId("ticker-status")).toHaveText("Stale");
  await expect(page.locator(".d-live-stats")).toHaveAttribute(
    "data-health",
    "Stale",
  );
  await page.getByLabel("Funding rate details", { exact: true }).click();
  await expect(page.locator(".d-funding-popover")).toContainText(
    "last received, not a current quote",
  );
  send({ timestamp: await page.evaluate(() => Date.now()) });
  await page.clock.runFor(200);
  for (const metric of ["oracle", "funding", "volume"])
    await expect(page.getByTestId(`market-${metric}`)).toHaveText("—");
  await expect(page.getByTestId("market-mark")).toHaveText("152.00");
});

test("Standard streams venue data without resetting its chart and stays separate from Pro", async ({
  page,
}) => {
  const { sockets } = await mockMarketData(page);
  await page.goto("/demo");
  const chart = page.locator(".d-tv-chart");
  await expect(chart).toHaveAttribute("data-last-close", "152");
  await expect(page.getByTestId("book-status")).toHaveText("Live");
  const instance = await chart.getAttribute("data-chart-instance");
  const beforeZoom = await chart.getAttribute("data-chart-visible-from");
  await page.getByRole("button", { name: "Zoom in chart" }).click();
  await expect(chart).not.toHaveAttribute(
    "data-chart-visible-from",
    beforeZoom!,
  );
  const zoomedFrom = await chart.getAttribute("data-chart-visible-from");
  const zoomedTo = await chart.getAttribute("data-chart-visible-to");
  const current = bars().at(-1)!;
  const initialSocket = sockets.find((s) => !s.closed)!;
  initialSocket.socket.send(
    JSON.stringify({
      channel: "candle",
      data: { ...current, c: 153, h: 154, s: "SOL", i: "15m" },
    }),
  );
  await expect(chart).toHaveAttribute("data-last-close", "153");
  await expect(chart).toHaveAttribute("data-chart-instance", instance!);
  await expect(chart).toHaveAttribute("data-chart-visible-from", zoomedFrom!);
  await expect(chart).toHaveAttribute("data-chart-visible-to", zoomedTo!);
  await chooseVenue(page, "Execution venue", "bulk");
  await expect(chart).toHaveAttribute("data-chart-key", "SOL-bulk-15m");
  await expect(page.getByTestId("market-mark")).toHaveText("153.00");
  await expect.poll(() => initialSocket.closed).toBe(true);
  await page.getByRole("button", { name: "5m", exact: true }).click();
  await expect(chart).toHaveAttribute("data-chart-key", "SOL-bulk-5m");
  await page
    .getByRole("combobox", { name: "Market", exact: true })
    .selectOption("BTC");
  await expect(page.getByTestId("market-mark")).toHaveText("86,000.00");
  await page.getByRole("radio", { name: "Pro", exact: true }).check();
  await expect(page.getByTestId("route-card")).toContainText(
    "Venue-only estimate",
  );
  await expect.poll(() => sockets.filter((s) => !s.closed).length).toBe(3);
});

test("price chart separates volume, resets to recent candles and retains horizontal zoom when auto scaling", async ({
  page,
}) => {
  await mockMarketData(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo");
  const chart = page.locator(".d-tv-chart");
  await expect(chart).toHaveAttribute("data-chart-status", "ready");
  await expect(chart).toHaveAttribute("data-candle-count", "80");
  await expect(chart).toHaveAttribute("data-chart-pane-count", "2");
  await expect
    .poll(async () =>
      Number(await chart.getAttribute("data-chart-visible-from")),
    )
    .toBeGreaterThan(0);
  const initialFrom = await chart.getAttribute("data-chart-visible-from");
  const initialTo = await chart.getAttribute("data-chart-visible-to");
  // Default/reset show a readable recent window, not the entire backfill.
  expect(Number(initialFrom)).toBeGreaterThan(0);
  expect(Number(initialTo) - Number(initialFrom)).toBeLessThan(80);
  await page.getByRole("button", { name: "Zoom in chart" }).click();
  await expect(chart).not.toHaveAttribute(
    "data-chart-visible-from",
    initialFrom!,
  );
  const zoomedFrom = await chart.getAttribute("data-chart-visible-from");
  const zoomedTo = await chart.getAttribute("data-chart-visible-to");
  expect(Number(zoomedTo) - Number(zoomedFrom)).toBeLessThan(
    Number(initialTo) - Number(initialFrom),
  );
  await page.getByRole("button", { name: "Auto scale price" }).click();
  await expect(chart).toHaveAttribute("data-chart-visible-from", zoomedFrom!);
  await expect(chart).toHaveAttribute("data-chart-visible-to", zoomedTo!);
  await page.getByRole("button", { name: "Reset chart view" }).click();
  await expect(chart).toHaveAttribute("data-chart-visible-from", initialFrom!);
  await expect(chart).toHaveAttribute("data-chart-visible-to", initialTo!);
  const volumePane = chart
    .locator("tr")
    .filter({ has: page.locator("canvas") })
    .nth(1);
  const originalVolumeHeight = (await volumePane.boundingBox())!.height;
  await chart.focus();
  await page.keyboard.press("Shift+ArrowUp");
  await expect
    .poll(async () => (await volumePane.boundingBox())!.height)
    .toBeGreaterThan(originalVolumeHeight);
  await page.keyboard.press("Home");
  await expect
    .poll(async () => (await volumePane.boundingBox())!.height)
    .toBe(originalVolumeHeight);
  const separator = (await chart.locator("tr").nth(1).boundingBox())!;
  await page.mouse.move(
    separator.x + separator.width / 2,
    separator.y + separator.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(separator.x + separator.width / 2, separator.y - 32, {
    steps: 5,
  });
  await page.mouse.up();
  await expect
    .poll(async () => (await volumePane.boundingBox())!.height)
    .toBeGreaterThan(originalVolumeHeight);
  await page.getByRole("button", { name: "Reset chart view" }).click();
  await page.getByRole("button", { name: "Zoom in chart" }).click();
  await expect(chart).not.toHaveAttribute(
    "data-chart-visible-from",
    initialFrom!,
  );
  await chart.focus();
  await page.keyboard.press("Home");
  await expect(chart).toHaveAttribute("data-chart-visible-from", initialFrom!);
  await page.getByRole("button", { name: "Zoom in chart" }).click();
  await expect(chart).not.toHaveAttribute(
    "data-chart-visible-from",
    initialFrom!,
  );
  await page.getByRole("button", { name: "5m", exact: true }).click();
  await expect(chart).toHaveAttribute("data-chart-key", "SOL-pacifica-5m");
  await expect(chart).toHaveAttribute("data-chart-visible-from", initialFrom!);
  await page.getByRole("button", { name: "Zoom in chart" }).click();
  await expect(chart).not.toHaveAttribute(
    "data-chart-visible-from",
    initialFrom!,
  );
  await chooseVenue(page, "Execution venue", "bulk");
  await expect(chart).toHaveAttribute("data-chart-key", "SOL-bulk-5m");
  await expect(chart).toHaveAttribute("data-last-close", "153");
  await expect(chart).toHaveAttribute("data-chart-visible-from", initialFrom!);
});

test("stale, disconnected and reconnected books never become synthetic prices", async ({
  page,
}) => {
  const { sockets } = await mockMarketData(page);
  await page.goto("/demo");
  await expect(page.getByTestId("book-status")).toHaveText("Live");
  await page.clock.install();
  await page.clock.fastForward(11000);
  await expect(page.getByTestId("book-status")).toHaveText("Stale");
  await sockets.find((s) => !s.closed)!.socket.close({ code: 1011 });
  await page.clock.runFor(2000);
  await expect.poll(() => sockets.length).toBeGreaterThan(1);
  const now = await page.evaluate(() => Date.now());
  sockets
    .at(-1)!
    .socket.send(JSON.stringify(bookMessage("pacifica", "SOL", 155, now)));
  await page.clock.runFor(200);
  await expect(page.getByTestId("book-status")).toHaveText("Live");
  await expect(page.locator(".d-bid").first()).toContainText("154.99");
});

test("BULK uses observed trades honestly when its native candles lag", async ({
  page,
}) => {
  const { sockets } = await mockMarketData(page);
  await page.goto("/demo?venue=bulk&interval=5m");
  const chart = page.locator(".d-tv-chart");
  await expect(chart).toHaveAttribute("data-last-close", "153");
  const socket = sockets.at(-1)!.socket;
  socket.send(
    JSON.stringify({
      type: "trades",
      topic: "trades.SOL-USD",
      data: { trades: [{ s: "SOL-USD", px: 155, sz: 1, time: Date.now() }] },
    }),
  );
  await expect(chart).toHaveAttribute("data-last-close", "155");
  await expect(page.getByTestId("candle-status")).toHaveText("Partial candle");
  await expect(page.locator(".d-feed-caption")).toContainText(
    "first candle incomplete",
  );
  const before = await chart.getAttribute("data-last-close");
  socket.send(
    JSON.stringify({
      type: "candle",
      topic: "candle.BTC-USD.5m",
      data: { candles: bars("5m", 99000) },
    }),
  );
  await expect(chart).toHaveAttribute("data-last-close", before!);
});

test("history failures and unsupported venues do not fall back to fixtures", async ({
  page,
}) => {
  await mockMarketData(page, { failHistory: true, quiet: true });
  await page.goto("/demo");
  await expect(page.getByText("Candle history could not load.")).toBeVisible();
  await expect(page.locator(".d-tv-chart")).toHaveAttribute(
    "data-candle-count",
    "0",
  );
  await expect(
    page.getByRole("button", { name: "Retry market data", exact: true }),
  ).toBeVisible();
  await chooseVenue(page, "Execution venue", "velocity");
  await expect(page.getByTestId("book-status")).toHaveText("Unavailable");
  await expect(
    page.getByText("Live data is not connected for this venue."),
  ).toBeVisible();
  await expect(page.getByTestId("market-mark")).toHaveText("—");
});

test("a malformed snapshot cannot overwrite the last valid book; empty books are explicit", async ({
  page,
}) => {
  const { sockets } = await mockMarketData(page);
  await page.goto("/demo");
  await expect(page.locator(".d-bid")).toHaveCount(8);
  const socket = sockets.at(-1)!.socket;
  socket.send(
    JSON.stringify({
      channel: "book",
      data: { s: "SOL", t: Date.now(), l: [[{ p: "NaN", a: 2 }], []] },
    }),
  );
  await expect(page.locator(".d-bid")).toHaveCount(8);
  socket.send(
    JSON.stringify({
      channel: "book",
      data: { s: "SOL", t: Date.now(), l: [[], []] },
    }),
  );
  await expect(page.getByText("No resting liquidity.")).toBeVisible();
  await expect(page.locator(".d-bid")).toHaveCount(0);
});

for (const width of [375, 768, 1280]) {
  test(`live Standard layout and accessible feed states at ${width}px`, async ({
    page,
  }, testInfo) => {
    await mockMarketData(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/demo");
    await expect(page.locator(".d-tv-chart")).toHaveAttribute(
      "data-last-close",
      "152",
    );
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("live-standard.png"),
      fullPage: true,
    });
  });
}

import { mockWallet, connectWallet } from "./helpers/wallet";
import { expect, test } from "@playwright/test";
import { chooseVenue } from "./helpers/venue-select";
import AxeBuilder from "@axe-core/playwright";
import {
  bookMessage,
  mockMarketData,
  phoenixBars,
  phoenixInfo,
} from "./helpers/market-data";
import {
  historyUrl,
  parseBook,
  parseCandles,
  parseInfo,
  parseTicker,
  subscriptions,
} from "../src/components/demo/market-data/adapters";
import { MarketFeed } from "../src/components/demo/market-data/feed";
import { feeUrl, parseVenueFee } from "../src/components/demo/market-data/fees";
import {
  compareLiveRoutes,
  comparisonStatus,
  type ComparisonFeeds,
} from "../src/components/demo/live-routing";
import type { RouteInput } from "../src/components/demo/routing";

test("Phoenix candles normalize REST milliseconds and streamed seconds without external backfills", () => {
  const now = Date.now();
  const rest = phoenixBars();
  const parsed = parseCandles(rest, "15m", now, "phoenix");
  expect(parsed).toHaveLength(80);
  expect(parsed.at(-1)?.time).toBe(rest.at(-1)!.time / 1000);
  expect(
    parseCandles(
      [{ ...rest.at(-1), time: rest.at(-1)!.time / 1000 }],
      "15m",
      now,
      "phoenix",
    ),
  ).toEqual(parsed.slice(-1));
  expect(
    parseCandles(
      [
        { ...rest[0], externalSource: "binance" },
        { ...rest[1], low: 200 },
      ],
      "15m",
      now,
      "phoenix",
    ),
  ).toEqual([]);
  const url = new URL(historyUrl("phoenix", "BTC", "4h", now));
  expect(url.pathname).toBe("/v1/candles/BTC");
  expect(url.searchParams.get("timeframe")).toBe("4h");
  expect(url.searchParams.get("enableExternalSource")).toBe("false");
  expect(subscriptions("phoenix", "SOL", "5m")).toEqual([
    { type: "subscribe", subscription: { channel: "l2Book", coin: "SOL" } },
    { type: "subscribe", subscription: { channel: "market", symbol: "SOL" } },
    {
      type: "subscribe",
      subscription: { channel: "candles", symbol: "SOL", timeframe: "5m" },
    },
  ]);
  expect(subscriptions("phoenix", "BTC", "15m", "comparison")).toHaveLength(1);
});

test("Phoenix decodes combined L2 atomically and never adds raw spline regions", () => {
  const frame = bookMessage("phoenix", "SOL", 152.5);
  const parsed = parseBook("phoenix", {
    ...frame,
    splines: [{ totalSize: 1e9 }],
  });
  expect(parsed?.bids[0]).toEqual({ price: 152.49, size: 1 });
  expect(parsed?.slot).toBe(frame.slot);
  expect(parsed?.time).toBe(frame.timestamp! * 1000);
  for (const patch of [
    { timestamp: undefined },
    { slot: -1 },
    { bypassExecutionBand: true },
    { bids: [[153, 1]] },
    { asks: [[152.51, -1]] },
    {
      bids: [
        [152.49, 1],
        [152.49, 2],
      ],
    },
    {
      asks: [
        [152.51, 1],
        [152.5, 2],
      ],
    },
  ])
    expect(parseBook("phoenix", { ...frame, ...patch })).toBeNull();
});

test("Phoenix fees and native lot/tick metadata have explicit units and market identity", () => {
  const now = Date.now();
  expect(parseInfo("phoenix", phoenixInfo(), "SOL")).toEqual({
    tick: 0.01,
    lot: 0.01,
    maxLeverage: 25,
  });
  expect(parseInfo("phoenix", phoenixInfo("BTC"), "BTC")).toEqual({
    tick: 1,
    lot: 0.0001,
    maxLeverage: 25,
  });
  expect(parseInfo("phoenix", phoenixInfo("BTC"), "SOL")).toBeNull();
  expect(
    parseInfo("phoenix", { ...phoenixInfo(), baseLotsDecimals: 99 }, "SOL"),
  ).toBeNull();
  expect(parseVenueFee("phoenix", "SOL", phoenixInfo(), now)?.takerBps).toBe(
    3.5,
  );
  expect(feeUrl("phoenix", "BTC")).toContain("/view/exchange/market/BTC");
  for (const patch of [
    { takerFee: null },
    { takerFee: -0.01 },
    { marketStatus: "closed" },
    { symbol: "BTC" },
  ])
    expect(
      parseVenueFee("phoenix", "SOL", { ...phoenixInfo(), ...patch }, now),
    ).toBeNull();
  expect(
    parseTicker(
      "phoenix",
      {
        markPx: 152.5,
        oraclePx: 152.45,
        midPx: 152.5,
        prevDayPx: 150,
        funding: -0.0002,
        dayNtlVlm: 123,
      },
      now,
    ),
  ).toMatchObject({
    mark: 152.5,
    oracle: 152.45,
    funding: -0.0002,
    volume: 123,
    time: now,
  });
});

test("three venues compare identical quantities and Phoenix can lead, fail or be excluded", () => {
  const now = Date.now();
  const feeds = Object.fromEntries(
    (["pacifica", "bulk", "phoenix"] as const).map((venue) => [
      venue,
      {
        ...new MarketFeed(venue, "SOL", "15m").getSnapshot(),
        connection: "connected",
        bookAt: now,
        now,
        book: {
          time: now,
          bids: [{ price: 99.99, size: 2000 }],
          asks: [{ price: 100.01, size: 2000 }],
        },
        fee: {
          takerBps: venue === "phoenix" ? 3.5 : 5,
          fetchedAt: now,
          source: "fixture",
          label: "Fixture",
        },
      },
    ]),
  ) as ComparisonFeeds;
  const input: RouteInput = {
    market: "SOL",
    side: "Buy",
    quantity: NaN,
    notional: 10000,
    leverage: 25,
    slippage: 1,
    allowed: ["pacifica", "bulk", "phoenix"],
    account: "funded",
    snapshot: "balanced",
  };
  const result = compareLiveRoutes(input, feeds, now);
  expect(result.ranked).toHaveLength(3);
  expect(result.ranked.every((q) => q.quantity === 100)).toBe(true);
  expect(result.best?.venue).toBe("phoenix");
  expect(result.best?.venueFee).toBeCloseTo(3.50035);
  expect(comparisonStatus(result)).toBe("Live books · 3 venues");
  expect(
    compareLiveRoutes({ ...input, side: "Sell" }, feeds, now).best?.venue,
  ).toBe("phoenix");
  expect(
    compareLiveRoutes({ ...input, allowed: ["pacifica", "bulk"] }, feeds, now)
      .ranked,
  ).toHaveLength(2);
  feeds.phoenix.fee = null;
  expect(
    compareLiveRoutes(input, feeds, now).candidates.find(
      (c) => c.venue === "phoenix",
    )?.quote,
  ).toBeNull();
  expect(
    compareLiveRoutes(input, feeds, now).live?.curves.find(
      (c) => c.venue === "phoenix",
    )?.points,
  ).toEqual([]);
});

test("Standard Phoenix switches markets and intervals with live chart, depth and statistics", async ({
  page,
}) => {
  const data = await mockMarketData(page, { phoenix: true, stream: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/demo?venue=phoenix");
  await expect(page.getByLabel("Execution venue")).toHaveAttribute(
    "data-value",
    "phoenix",
  );
  await expect(page.getByTestId("manual-chart-source")).toHaveText("Phoenix");
  await expect(page.getByTestId("book-status")).toHaveText("Live");
  await expect(page.locator(".d-tv-chart")).toHaveAttribute(
    "data-candle-count",
    "80",
  );
  await expect(page.getByTestId("market-mark")).toHaveText("152.50");
  await expect(page.getByTestId("market-oracle")).toHaveText("152.45");
  await expect(page.getByTestId("market-funding")).toHaveText("−0.02%");
  await page.getByLabel("Funding rate details").click();
  await expect(page.locator(".d-funding-popover")).toContainText(
    "without an hourly conversion",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "5m", exact: true }).click();
  await expect(page.locator(".d-tv-chart")).toHaveAttribute(
    "data-chart-key",
    "SOL-phoenix-5m",
  );
  await page
    .getByRole("combobox", { name: "Market", exact: true })
    .selectOption("BTC");
  await expect(page.getByTestId("market-mark")).toHaveText("86,010");
  await expect(page.locator(".d-tv-chart")).toHaveAttribute(
    "data-chart-key",
    "BTC-phoenix-5m",
  );
  expect(
    data.requests.some((u) => u.includes("/view/exchange/market/BTC")),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await expect.poll(() => data.sockets.filter((s) => !s.closed).length).toBe(0);
});

test("Pro shows three curves, independent Phoenix chart and honest depth limits", async ({
  page,
}) => {
  const data = await mockMarketData(page, { phoenix: true, stream: true });
  const writes: string[] = [];
  page.on("request", (r) => {
    if (!["GET", "HEAD"].includes(r.method())) writes.push(r.url());
  });
  await page.goto("/demo?mode=auto");
  await connectWallet(page);
  await expect(page.getByTestId("comparison-status")).toHaveText(
    /Live books · 3 venues/,
  );
  await expect(page.getByTestId("curve-phoenix")).toHaveCount(1);
  await expect(page.getByTestId("route-row-phoenix")).toContainText("Phoenix");
  await expect(page.getByRole("button", { name: /Smart route/ })).toContainText(
    "3 included venues",
  );
  await page.getByRole("tab", { name: "Price chart", exact: true }).click();
  await chooseVenue(page, "Chart source", "phoenix");
  await expect(page.locator(".d-tv-chart")).toHaveAttribute(
    "data-chart-key",
    "SOL-phoenix-15m",
  );
  await page.getByRole("tab", { name: "Execution cost", exact: true }).click();
  await page.getByLabel("Order size", { exact: true }).fill("100000");
  await expect(page.getByTestId("route-row-phoenix")).toContainText(
    "Insufficient visible depth",
  );
  await page.getByLabel("Order size", { exact: true }).fill("10000");
  data.sockets.find((s) => s.venue === "phoenix" && !s.closed)!.paused = true;
  await expect(page.getByTestId("route-row-phoenix")).toContainText("Delayed");
  await expect(page.getByTestId("curve-phoenix")).toHaveCount(0);
  await expect(page.getByTestId("delayed-curve-phoenix")).toHaveCount(1);
  await expect(page.getByTestId("comparison-status")).toHaveText(
    /Live books · 2 venues/,
  );
  expect(writes).toEqual([]);
});

test("Phoenix ignores regressing slots and foreign-market messages", async ({
  page,
}) => {
  const { sockets } = await mockMarketData(page, { phoenix: true });
  await page.goto("/demo?venue=phoenix");
  await expect(page.getByTestId("book-status")).toHaveText("Live");
  const socket = sockets.find(
    (s) => s.venue === "phoenix" && !s.closed,
  )!.socket;
  const time = Date.now();
  const book = bookMessage("phoenix", "SOL", 180, time);
  socket.send(JSON.stringify(book));
  await expect(page.locator(".d-book")).toContainText("180.01");
  socket.send(
    JSON.stringify({
      ...bookMessage("phoenix", "SOL", 999, time + 1000),
      slot: book.slot! - 1,
    }),
  );
  socket.send(JSON.stringify(bookMessage("phoenix", "BTC", 888, time + 1000)));
  socket.send(
    JSON.stringify({
      channel: "candle",
      symbol: "BTC",
      timeframe: "15m",
      candle: phoenixBars().at(-1),
    }),
  );
  await expect(page.locator(".d-book")).not.toContainText("999.01");
  await expect(page.locator(".d-book")).not.toContainText("888.01");
});

test.beforeEach(async ({ page }) => {
  await mockWallet(page);
});

for (const width of [375, 768, 1280])
  test(`Phoenix comparison remains accessible at ${width}px`, async ({
    page,
  }) => {
    await mockMarketData(page, { phoenix: true, stream: true });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/demo?mode=auto");
    await expect(page.getByTestId("curve-phoenix")).toHaveCount(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const result = await new AxeBuilder({ page })
      .include(".d-workspace")
      .analyze();
    expect(result.violations).toEqual([]);
  });

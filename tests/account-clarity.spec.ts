import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockMarketData, bookMessage } from "./helpers/market-data";
import { mockWallet, connectWallet } from "./helpers/wallet";
import {
  newPaperAccount,
  PAPER_PREFIX,
} from "../src/components/demo/paper-account";

const wallet = "11111111111111111111111111111111";
test.beforeEach(async ({ page }) => {
  await mockWallet(page);
});

test("portfolio equity and position bars include all markets but exclude pending reservations", async ({
  page,
}) => {
  const data = await mockMarketData(page, { stream: true, phoenix: true });
  const account = newPaperAccount(wallet);
  account.positions = [
    {
      id: "pacifica-SOL",
      market: "SOL",
      venue: "pacifica",
      quantity: 10,
      entry: 150,
      margin: 60,
      leverage: 25,
    },
    {
      id: "bulk-BTC",
      market: "BTC",
      venue: "bulk",
      quantity: -0.02,
      entry: 87000,
      margin: 174,
      leverage: 10,
    },
  ];
  const at = new Date().toISOString();
  account.orders = [
    {
      id: "P-O-fixture",
      draft: {
        id: "",
        market: "SOL",
        venue: "pacifica",
        mode: "manual",
        side: "Buy",
        type: "Limit",
        size: "1000",
        sizeUnit: "USDC",
        limit: "100",
        slippage: "0.5",
        leverage: "10",
        allowed: ["pacifica"],
      },
      quantity: 10,
      reserve: 100.28,
      status: "Open",
      createdAt: at,
      updatedAt: at,
      bracket: {},
    },
  ];
  await page.addInitScript(
    ({ key, account }) => localStorage.setItem(key, JSON.stringify(account)),
    { key: PAPER_PREFIX + wallet, account },
  );
  await page.goto("/demo?view=account&scope=all");
  await connectWallet(page);
  await expect(page.locator(".d-header-balance")).toContainText("10,040.00");
  await expect(
    page.getByRole("heading", { name: "Account overview" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Capital availability" }),
  ).toContainText("9,665.72 USDC");
  await expect(
    page.getByRole("region", { name: "Capital availability" }),
  ).toContainText("Unavailable");
  await expect(page.getByTestId("margin-committed")).toHaveText("234.00 USDC");
  await expect(page.getByTestId("margin-pacifica")).toContainText("60.00 USDC");
  const breakdown = page.locator(".d-balance-breakdown summary");
  await breakdown.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("region", { name: "Equity valuation" }),
  ).toContainText("40.00 USDC");
  await expect(
    page.getByRole("region", { name: "Paper margin capacity" }),
  ).toContainText("100.28 USDC");
  await expect(page.locator(".d-paper-table")).toContainText("BTC-PERP");
  await expect(page.locator(".d-paper-table")).not.toContainText(
    "Mark unavailable",
  );
  // Only held instruments request ticker valuation, without candles or fees.
  expect(
    data.sockets.some(
      (s) =>
        s.venue === "bulk" &&
        s.messages.some(
          (m) =>
            Array.isArray(m.subscription) &&
            m.subscription.length === 1 &&
            m.subscription[0].type === "ticker" &&
            m.subscription[0].symbol === "BTC-USD",
        ),
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Trade", exact: true }).click();
  await expect(page.locator(".d-ticket-available")).toContainText(
    "9,665.72 USDC",
  );
  await expect(page.getByLabel("Current position")).toContainText(
    "SOL · Pacifica",
  );
  await expect(page.getByLabel("Current position")).toContainText(
    "1,520.00 USDC exposure",
  );
  await page.getByRole("radio", { name: "Pro", exact: true }).check();
  await expect(page.locator(".d-ticket-available")).toContainText(
    "9,665.72 USDC",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("live initial limit and all draft inputs survive updates, navigation, modes and market round trips", async ({
  page,
}) => {
  const data = await mockMarketData(page, { stream: true, phoenix: true });
  await page.goto("/demo");
  await connectWallet(page);
  const limit = page.getByLabel("Limit price", { exact: true });
  await expect(limit).toHaveValue("152.00");
  await limit.fill("145.25");
  await page.getByLabel("Order size", { exact: true }).fill("750");
  const chart = data.sockets.find(
    (s) =>
      s.venue === "pacifica" &&
      s.messages.some(
        (m) =>
          m.params && (m.params as Record<string, unknown>).source === "candle",
      ),
  )!;
  chart.socket.send(JSON.stringify(bookMessage("pacifica", "SOL", 154)));
  await expect(limit).toHaveValue("145.25");
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Trade", exact: true }).click();
  await expect(limit).toHaveValue("145.25");
  await page.getByRole("radio", { name: "Pro", exact: true }).check();
  await page.getByLabel("Order size", { exact: true }).fill("2000");
  await page.getByRole("radio", { name: "Standard", exact: true }).check();
  await expect(page.getByLabel("Order size", { exact: true })).toHaveValue(
    "750",
  );
  await page
    .getByRole("combobox", { name: "Market", exact: true })
    .selectOption("BTC");
  await expect(limit).toHaveValue("86000.00");
  await limit.fill("85000");
  await page
    .getByRole("combobox", { name: "Market", exact: true })
    .selectOption("SOL");
  await expect(limit).toHaveValue("145.25");
  await page.getByRole("radio", { name: "Pro", exact: true }).check();
  await expect(page.getByLabel("Order size", { exact: true })).toHaveValue(
    "2000",
  );
  await page.getByRole("radio", { name: "Standard", exact: true }).check();
  await limit.fill("");
  await page.getByRole("button", { name: "Place buy order" }).click();
  await expect(page.locator("#d-limit-error")).toContainText("limit price");
  await expect(limit).toHaveValue("");
});

test("stale portfolio marks make equity unavailable without erasing cash or margin capacity", async ({
  page,
}) => {
  const data = await mockMarketData(page, { stream: true, phoenix: true });
  const account = newPaperAccount(wallet);
  account.positions = [
    {
      id: "pacifica-SOL",
      market: "SOL",
      venue: "pacifica",
      quantity: 10,
      entry: 150,
      margin: 60,
      leverage: 25,
    },
  ];
  await page.addInitScript(
    ({ key, account }) => localStorage.setItem(key, JSON.stringify(account)),
    { key: PAPER_PREFIX + wallet, account },
  );
  await page.goto("/demo?view=account");
  await connectWallet(page);
  await expect(page.locator(".d-header-balance")).toContainText("10,020.00");
  // This mock streams books but sends each mark just once, modeling a stalled
  // valuation channel while the executable order books remain healthy.
  await expect(page.locator(".d-header-balance strong")).toContainText("—", {
    timeout: 12000,
  });
  await expect(page.locator(".d-equity")).toContainText(
    "Valuation unavailable",
  );
  await expect(page.locator(".d-paper-table")).toContainText(
    "Exposure unavailable",
  );
  await expect(
    page.getByRole("region", { name: "Capital availability" }),
  ).toContainText("9,940.00 USDC");
  await page.locator(".d-balance-breakdown summary").click();
  await expect(
    page.getByRole("region", { name: "Equity valuation" }),
  ).toContainText("10,000.00 USDC");
  await expect(page.locator(".d-mark-unavailable")).toContainText(
    "SOL · Pacifica",
  );
  for (const socket of data.sockets.filter(
    (s) => s.venue === "pacifica" && !s.closed,
  ))
    socket.socket.send(
      JSON.stringify({
        channel: "prices",
        data: [{ symbol: "SOL", mark: "154", timestamp: Date.now() }],
      }),
    );
  await expect(page.locator(".d-header-balance")).toContainText("10,040.00");
  await expect(
    page.getByRole("region", { name: "Capital availability" }),
  ).toContainText("9,940.00 USDC");
});

for (const width of [375, 768, 1280]) {
  test(`expanded financial breakdown is accessible and stable at ${width}px`, async ({
    page,
  }, testInfo) => {
    await mockMarketData(page, { stream: true, phoenix: true });
    await page.setViewportSize({ width, height: 1100 });
    await page.goto("/demo?view=account");
    await connectWallet(page);
    await page.locator(".d-balance-breakdown summary").click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`account-clarity-${width}.png`),
      fullPage: true,
    });
  });
}

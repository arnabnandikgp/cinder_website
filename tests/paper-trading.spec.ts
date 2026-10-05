import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bookMessage, mockMarketData } from "./helpers/market-data";
import { mockWallet } from "./helpers/wallet";
import { PAPER_PREFIX } from "../src/components/demo/paper-account";
const address = "11111111111111111111111111111111";
let marketData: Awaited<ReturnType<typeof mockMarketData>>;
async function connect(page: Page) {
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page.getByRole("button", { name: "Test Solana Wallet" }).click();
  await expect(page.getByLabel("Order size", { exact: true })).toBeEnabled();
}
async function market(page: Page, size = "1000") {
  await page.getByRole("radio", { name: "Market", exact: true }).check();
  await page.getByLabel("Order size", { exact: true }).fill(size);
  await expect(page.locator(".d-ticket-summary")).toContainText("2.80 bps");
}
test.beforeEach(async ({ page }) => {
  await mockWallet(page);
  marketData = await mockMarketData(page, { stream: true, phoenix: true });
});
test("wallet gates both tickets and size presets; connecting grants only paper funds", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(page.getByLabel("Order size", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Limit price", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "View account balance (simulated)" }),
  ).toContainText("0.00");
  await page.getByRole("radio", { name: "Pro", exact: true }).check();
  await expect(page.getByLabel("Order size", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Set order notional to 25000 USDC" }),
  ).toBeDisabled();
  await connect(page);
  await expect(
    page.getByRole("button", { name: "View account balance (simulated)" }),
  ).toContainText("10,000.00");
  expect(await page.evaluate(() => window.cinderWalletTest.calls)).toEqual([
    "connect",
  ]);
  await page.evaluate(() => window.cinderWalletTest.change());
  await expect(page.getByLabel("Order size", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "View account balance (simulated)" }),
  ).toContainText("0.00");
});
test("direct paper fill appears in positions, history, Account and Activity; reconnect restores records", async ({
  page,
}) => {
  await page.goto("/demo");
  await connect(page);
  await market(page);
  await page.getByRole("button", { name: "Place buy order" }).click();
  await expect(page.locator(".d-paper-table")).toContainText("Long");
  await expect(page.locator(".d-feedback-note")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".d-paper-table")).toContainText("Long");
  const before = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    PAPER_PREFIX + address,
  );
  expect(before.fills).toHaveLength(1);
  await page.getByRole("tab", { name: "Trade history" }).click();
  await expect(page.locator(".d-paper-table")).toContainText(
    before.orders[0].id,
  );
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.getByTestId("margin-committed")).not.toContainText(
    "0.00 USDC",
  );
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page.locator(".d-events")).toContainText(
    "Cinder vault → Cinder account on Pacifica",
  );
  await expect(page.locator(".d-events")).toContainText("Paper order filled");
  await expect(page.locator(".d-events")).toContainText(
    "Modeled venue fee booked",
  );
  await page.reload();
  await expect(page.locator(".d-events li")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page.getByRole("button", { name: "Test Solana Wallet" }).click();
  await expect(page.locator(".d-events")).toContainText("Paper order filled");
  expect(await page.evaluate(() => window.cinderWalletTest.calls)).toEqual([
    "connect",
  ]);
});
test("successful paper actions stay banner-free while errors remain visible", async ({
  page,
}) => {
  await page.goto("/demo");
  await connect(page);
  await market(page, "10000");
  await page.getByLabel("Leverage", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "Place buy order" }).click();
  await expect(page.locator(".d-feedback-note")).toContainText(
    "Not enough available paper collateral",
  );
  await expect(page.locator(".d-ticket .d-error")).toContainText(
    "Not enough available paper collateral",
  );
  await page.getByLabel("Order size", { exact: true }).fill("1000");
  await page.getByRole("button", { name: "Place buy order" }).click();
  await expect(page.locator(".d-paper-table")).toContainText("Long");
  await expect(page.locator(".d-feedback-note")).toHaveCount(0);
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset paper account", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset paper account", exact: true })
    .click();
  await expect(page.locator(".d-header-balance")).toContainText("10,000.00");
  await expect(page.locator(".d-feedback-note")).toHaveCount(0);
});
test("brackets, slippage dialog, resting limits, cancellations and reset", async ({
  page,
}) => {
  await page.goto("/demo");
  await connect(page);
  await page.getByLabel("Limit price", { exact: true }).fill("100");
  await page.getByLabel("Order size", { exact: true }).fill("1000");
  await page.getByRole("checkbox", { name: "Take profit / Stop loss" }).check();
  await page.getByLabel("Take profit gain percent").fill("2");
  await page.getByLabel("Stop loss loss percent").fill("1");
  await expect(
    page.getByLabel("Take profit price", { exact: true }),
  ).toHaveValue("102");
  await expect(page.getByLabel("Stop loss price", { exact: true })).toHaveValue(
    "99",
  );
  await page.getByRole("button", { name: "Place buy order" }).click();
  await expect(page.locator(".d-paper-table")).toContainText("Open");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".d-ticket-available")).toContainText("10,000.00");
  await market(page);
  await page.getByRole("button", { name: /Set maximum slippage/ }).click();
  await page.getByLabel("Custom percentage").fill("100");
  await page.getByRole("button", { name: "Save slippage" }).click();
  await expect(page.getByRole("dialog")).toContainText("below 100");
  await page.getByLabel("Custom percentage").fill("1");
  await page.getByRole("button", { name: "Save slippage" }).click();
  await expect(
    page.getByRole("button", { name: /Set maximum slippage, currently 1%/ }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset paper account", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset paper account", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "View account balance (simulated)" }),
  ).toContainText("10,000.00");
  const a = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    PAPER_PREFIX + address,
  );
  expect(a.orders).toHaveLength(0);
  expect(a.events).toHaveLength(1);
});
test("Pro is continuous and compact; submits a freshly recomputed paper route without review", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/demo?mode=auto");
  await connect(page);
  await page.getByLabel("Order size", { exact: true }).fill("1000");
  await expect(page.getByTestId("recommended-venue")).not.toContainText(
    "No estimate",
  );
  await expect(page.locator(".d-route-card details")).toHaveCount(0);
  await expect(page.locator(".d-route-card")).toContainText("Entry cost");
  await page.getByRole("button", { name: "Place buy order" }).click();
  await expect(page.locator(".d-paper-table")).toContainText("Long");
  await expect(page.locator(".d-feedback-note")).toHaveCount(0);
  const a = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    PAPER_PREFIX + address,
  );
  expect(a.fills).toHaveLength(1);
  expect(a.positions[0].venue).toBe("pacifica");
  expect(await page.evaluate(() => window.cinderWalletTest.calls)).toEqual([
    "connect",
  ]);
  await page.locator(".d-ticket").evaluate((node) => {
    node.scrollTop = 0;
  });
  await page.screenshot({
    path: "/private/tmp/cinder-paper-pro-workspace.png",
  });
  await page
    .locator(".d-ticket")
    .screenshot({ path: "/private/tmp/cinder-paper-pro.png" });
});

test("wallet changes isolate balances and records, unregister locks orders, duplicate clicks do not duplicate fills", async ({
  page,
}) => {
  await page.goto("/demo");
  await connect(page);
  await market(page);
  await page.getByRole("button", { name: "Place buy order" }).dblclick();
  await expect(page.locator(".d-paper-table")).toContainText("Long");
  await expect(page.locator(".d-feedback-note")).toHaveCount(0);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).fills.length,
      PAPER_PREFIX + address,
    ),
  ).toBe(1);
  await page.getByRole("button", { name: "Reduce", exact: true }).click();
  await page.getByRole("button", { name: "Place sell order" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("No positions");
  const cash = await page.locator(".d-header-balance strong").innerText();
  await page.evaluate(() =>
    window.cinderWalletTest.change("22222222222222222222222222222222"),
  );
  await expect(page.locator(".d-header-balance")).toContainText("10,000.00");
  await expect(page.getByRole("tabpanel")).toContainText("No positions");
  await page.evaluate(() =>
    window.cinderWalletTest.change("11111111111111111111111111111111"),
  );
  await expect(page.locator(".d-header-balance strong")).toHaveText(cash);
  await page.getByRole("tab", { name: "Trade history" }).click();
  await expect(page.locator(".d-paper-table tbody tr")).toHaveCount(2);
  await page.evaluate(() => window.cinderWalletTest.unregister());
  await expect(page.getByLabel("Order size", { exact: true })).toBeDisabled();
  await expect(page.locator(".d-header-balance")).toContainText("0.00");
  expect(await page.evaluate(() => window.cinderWalletTest.calls)).toEqual([
    "connect",
  ]);
});

test("corrupt paper records are reset safely with a notice, and storage failure remains usable", async ({
  page,
}) => {
  await page.addInitScript(
    (key) => localStorage.setItem(key, '{"version":1,"cash":"fake"}'),
    PAPER_PREFIX + address,
  );
  await page.goto("/demo");
  await connect(page);
  await expect(page.locator(".d-feedback-note")).toContainText(
    "Unreadable paper records",
  );
  await expect(page.locator(".d-header-balance")).toContainText("10,000.00");
  await page.evaluate(() => window.cinderWalletTest.change());
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Storage blocked");
    };
  });
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page.getByRole("button", { name: "Test Solana Wallet" }).click();
  await market(page);
  await page.getByRole("button", { name: "Place buy order" }).click();
  await expect(page.locator(".d-paper-table")).toContainText("Long");
  await expect(
    page.getByText(
      "Browser storage unavailable. This paper account will last only for this visit.",
      { exact: true },
    ),
  ).toBeVisible();
  for (const feed of marketData.sockets.filter(
    (s) => s.venue === "pacifica" && !s.closed,
  )) {
    feed.paused = true;
    feed.socket.send(JSON.stringify(bookMessage("pacifica", "SOL", 153)));
  }
  // A subsequent account-monitor tick must not reload the old 10k stored
  // ledger over the newer in-memory fill when writes have been denied.
  // The venue mark-price ticker is a different stream; this injected change
  // updates the observed book midpoint used by the paper-position monitor.
  await expect(page.locator(".d-paper-table")).toContainText("$153.00");
  await expect(page.locator(".d-header-balance")).not.toContainText(
    "10,000.00",
  );
});
for (const width of [375, 768, 1440])
  test(`paper ticket is accessible and fits at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/demo");
    await connect(page);
    await market(page);
    await page
      .getByRole("checkbox", { name: "Take profit / Stop loss" })
      .check();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations).toEqual([]);
    if (width === 1440)
      await page.screenshot({ path: "/private/tmp/cinder-paper-ticket.png" });
  });

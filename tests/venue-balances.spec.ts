import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockWallet, connectWallet } from "./helpers/wallet";
import { mockMarketData } from "./helpers/market-data";
import {
  newPaperAccount,
  PAPER_PREFIX,
  LEGACY_PAPER_PREFIX,
  type PaperAccount,
} from "../src/components/demo/paper-account";

const wallet = "11111111111111111111111111111111";
test.beforeEach(async ({ page }) => {
  await mockWallet(page);
  await mockMarketData(page, { stream: true, phoenix: true });
});
async function seed(page: Page, account: PaperAccount) {
  await page.addInitScript(
    ({ key, account }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(account));
    },
    { key: PAPER_PREFIX + wallet, account },
  );
}
async function stored(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!) as PaperAccount,
    PAPER_PREFIX + wallet,
  );
}
async function market(page: Page) {
  await page.getByRole("radio", { name: "Market", exact: true }).check();
  await page.getByLabel("Order size", { exact: true }).fill("1000");
  await expect(page.locator(".d-ticket-summary")).toContainText(
    "Estimated fees",
  );
}

test("venue cards filter records independently and top-ups persist without creating money", async ({
  page,
}) => {
  await page.goto("/demo?view=account");
  await connectWallet(page);
  await expect(page.getByTestId("portfolio-equity")).toHaveText(
    "15,000.00 USDC",
  );
  for (const venue of ["pacifica", "bulk", "phoenix"])
    await expect(page.getByTestId("available-" + venue)).toHaveText(
      "5,000.00 USDC",
    );
  await page.getByRole("button", { name: "Top up BULK", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (USDC)").fill("1000");
  await expect(dialog).toContainText("10,000.00 USDC → 9,000.00 USDC");
  await dialog.getByRole("button", { name: "Confirm demo top-up" }).dblclick();
  await expect(
    dialog.getByRole("heading", { name: "Demo balance updated" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByTestId("available-bulk")).toHaveText("6,000.00 USDC");
  await expect(page.getByTestId("portfolio-equity")).toHaveText(
    "16,000.00 USDC",
  );
  const account = await stored(page);
  expect(account.walletCash).toBe(9000);
  expect(
    account.events.filter((e) => e.title === "Demo venue topped up"),
  ).toHaveLength(1);
  await page.getByRole("button", { name: "Show BULK records" }).click();
  await expect(page).toHaveURL(/accountScope=bulk/);
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page.locator(".d-events")).toContainText(
    "Demo wallet → BULK trading balance",
  );
  await page.reload();
  await connectWallet(page);
  expect(await stored(page)).toEqual(account);
  expect(await page.evaluate(() => window.cinderWalletTest.calls)).toEqual([
    "connect",
  ]);
});

test("an unfunded Standard ticket preserves inputs through a contextual top-up and revalidates on submit", async ({
  page,
}) => {
  const account = newPaperAccount(wallet);
  account.venueCash.pacifica = 0;
  await seed(page, account);
  await page.goto("/demo");
  await connectWallet(page);
  await market(page);
  await expect(page.locator(".d-ticket-available")).toContainText("0.00 USDC");
  await page
    .getByRole("button", { name: "Top up Pacifica", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const amount = Number(await dialog.getByLabel("Amount (USDC)").inputValue());
  expect(amount).toBeGreaterThan(40);
  await dialog.getByRole("button", { name: "Confirm demo top-up" }).click();
  await expect(dialog).toContainText("Demo balance updated");
  expect((await stored(page)).orders).toHaveLength(0);
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByLabel("Order size", { exact: true })).toHaveValue(
    "1000",
  );
  await page.getByRole("button", { name: "Place buy order" }).click();
  await expect(page.locator(".d-paper-table")).toContainText("Long");
  const after = await stored(page);
  expect(after.venueCash.bulk).toBe(5000);
  expect(after.walletCash).toBeCloseTo(10000 - amount, 6);
  expect(after.fills).toHaveLength(1);
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.getByTestId("available-bulk")).toHaveText("5,000.00 USDC");
});

test("Pro keeps a cheaper unfunded venue in the cost table, but routes to a funded venue", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const account = newPaperAccount(wallet);
  account.venueCash.bulk = 0;
  await seed(page, account);
  await page.goto("/demo?mode=auto");
  await connectWallet(page);
  await page.getByLabel("Order size", { exact: true }).fill("1000");
  await expect(page.getByTestId("recommended-venue")).toContainText("Pacifica");
  await expect(page.getByTestId("funding-status-bulk")).toContainText(
    "Top-up required",
  );
  await expect(page.locator(".d-route-card")).toContainText(
    "Best funded route",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("funded-pro-route.png"),
    fullPage: true,
  });
  await page
    .locator(".d-route-funding-alternative")
    .getByRole("button")
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Confirm demo top-up" }).click();
  await expect(dialog).toContainText("Demo balance updated");
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByTestId("recommended-venue")).toContainText("BULK");
  await page.getByRole("button", { name: "Place buy order" }).click();
  await expect(page.locator(".d-paper-table")).toContainText("Long");
  expect((await stored(page)).positions[0].venue).toBe("bulk");
});

test("returns cannot remove position requirements and cancelled pending updates do not transfer", async ({
  page,
}) => {
  await page.goto("/demo");
  await connectWallet(page);
  await market(page);
  await page.getByRole("button", { name: "Place buy order" }).click();
  await expect(page.locator(".d-paper-table")).toContainText("Long");
  await page.getByRole("button", { name: "Account", exact: true }).click();
  const before = await stored(page);
  await page
    .getByRole("button", { name: "Return Pacifica funds to demo wallet" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (USDC)").fill("5000");
  await dialog.getByRole("button", { name: "Confirm demo return" }).click();
  await expect(dialog.getByRole("alert")).toContainText("exceeds");
  await dialog.getByRole("button", { name: "Max", exact: true }).click();
  const value = Number(await dialog.getByLabel("Amount (USDC)").inputValue());
  expect(value).toBeLessThan(5000);
  await dialog.getByRole("button", { name: "Confirm demo return" }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  // Wait past the local pending delay by observing another UI action.
  await page.getByRole("button", { name: "Show BULK records" }).click();
  expect(await stored(page)).toEqual(before);
  await page
    .getByRole("button", { name: "Return Pacifica funds to demo wallet" })
    .click();
  await dialog.getByRole("button", { name: "Max", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirm demo return" }).click();
  await expect(dialog).toContainText("Demo balance updated");
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByTestId("available-pacifica")).toHaveText("0.00 USDC");
  expect((await stored(page)).positions).toEqual(before.positions);
});

test("saved v1 accounts migrate once without credit and retain their original backup", async ({
  page,
}) => {
  const old = { ...newPaperAccount(wallet), version: 1, cash: 10000 } as Record<
    string,
    unknown
  >;
  delete old.venueCash;
  delete old.walletCash;
  const raw = JSON.stringify(old);
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), {
    key: LEGACY_PAPER_PREFIX + wallet,
    raw,
  });
  await page.goto("/demo?view=account");
  await connectWallet(page);
  await expect(page.locator(".d-feedback-note")).toContainText(
    "Saved demo upgraded",
  );
  await expect(page.getByTestId("portfolio-equity")).toHaveText(
    "10,000.00 USDC",
  );
  const migrated = await stored(page);
  expect(migrated.walletCash).toBe(0);
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      LEGACY_PAPER_PREFIX + wallet,
    ),
  ).toBe(raw);
  await page.reload();
  await connectWallet(page);
  expect(await stored(page)).toEqual(migrated);
});

for (const width of [375, 768, 1280])
  test(`venue cards and funding drawer are accessible at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1100 });
    await page.goto("/demo?view=account");
    await connectWallet(page);
    await page.screenshot({
      path: testInfo.outputPath(`venues-${width}.png`),
      fullPage: true,
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const action = page.getByRole("button", {
      name: "Top up Pacifica",
      exact: true,
    });
    await action.click();
    await page.getByLabel("Amount (USDC)").fill("250");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`funding-${width}.png`),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(action).toBeFocused();
  });

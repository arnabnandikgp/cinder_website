import { mockWallet, connectWallet } from "./helpers/wallet";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockMarketData } from "./helpers/market-data";

test.beforeEach(async ({ page }) => {
  await mockWallet(page);
});

test.beforeEach(async ({ page }) => {
  await mockMarketData(page, { stream: true });
});

for (const view of ["account", "activity", "agents"]) {
  for (const width of [375, 768, 1280]) {
    test(`${view} has a neutral, accessible workspace at ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 1100 });
      await page.goto(`/demo?view=${view}`);
      await expect(page.locator(".d-account-content")).toHaveCSS(
        "background-color",
        "rgb(11, 11, 11)",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      // Catch internal ledger overflow as well as outer document overflow.
      expect(
        await page
          .locator(".d-account-content")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      ).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`${view}-${width}.png`),
        fullPage: true,
      });
    });
  }
}

test("read-only meters show only venue shares of position requirements", async ({
  page,
}) => {
  await page.goto("/demo");
  await connectWallet(page);
  await page.getByRole("radio", { name: "Market", exact: true }).check();
  await page.getByLabel("Order size", { exact: true }).fill("1000");
  await expect(page.locator(".d-ticket-summary")).toContainText("2.80 bps");
  await page.getByRole("button", { name: "Place buy order" }).click();
  await expect(page.locator(".d-paper-table")).toContainText("Long");
  await expect(page.locator(".d-feedback-note")).toHaveCount(0);
  await page.getByRole("button", { name: "Account", exact: true }).click();
  const meter = page.getByRole("meter", {
    name: "Pacifica share of position margin requirements",
  });
  expect(Number(await meter.getAttribute("value"))).toBeGreaterThan(40);
  expect(await meter.getAttribute("value")).toBe(
    await meter.getAttribute("max"),
  );
  await expect(
    page.getByRole("meter", {
      name: "BULK share of position margin requirements",
    }),
  ).toHaveAttribute("value", "0");
  await expect(page.locator(".d-allocation-note")).toContainText(
    "not editable allocations or separate venue accounts",
  );
});

test("ledger attributes venues and opens funding and transfer details without inventing orders", async ({
  page,
}) => {
  await page.goto("/demo?view=activity");
  await connectWallet(page);
  await expect(page.locator(".d-events li")).toHaveCount(1);
  await page.locator(".d-event-inspect").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Paper account credited");
  await expect(dialog).toContainText("+10,000.00 USDC");
  await expect(dialog).not.toContainText("EX-");
  await page.keyboard.press("Escape");
  await expect(page.locator(".d-event-inspect")).toBeFocused();
  await page.getByRole("button", { name: "Funding", exact: true }).click();
  await expect(page.locator(".d-events li")).toHaveCount(0);
});

test("allowance meter remains historical when an agent grant is expired", async ({
  page,
}) => {
  await page.goto("/demo?view=agents");
  const meter = page.getByRole("meter", {
    name: "Remaining accepted-order allowance",
  });
  await expect(meter).toHaveAttribute("value", "92");
  await expect(meter).toHaveAttribute("max", "100");
  await page.getByRole("button", { name: "Inspect BTC hedger" }).click();
  await expect(meter).toHaveAttribute("value", "46");
  await expect(meter).toHaveAttribute("data-inactive", "true");
  await expect(page.locator(".d-agent-allowance")).toContainText(
    "Historical allowance · Grant inactive",
  );
});

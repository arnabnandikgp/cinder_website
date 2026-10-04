import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockMarketData } from "./helpers/market-data";

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

test("allocation meters show only venue shares of committed margin", async ({
  page,
}) => {
  await page.goto("/demo?view=account");
  await expect(
    page.getByRole("meter", { name: "Pacifica share of committed margin" }),
  ).toHaveAttribute("value", "800");
  await expect(
    page.getByRole("meter", { name: "BULK share of committed margin" }),
  ).toHaveAttribute("value", "1800");
  for (const meter of await page.locator(".d-margin-breakdown meter").all()) {
    await expect(meter).toHaveAttribute("max", "2600");
  }
  await expect(page.locator(".d-allocation-note")).toContainText(
    "not account equity",
  );
  await page.goto("/demo?view=account&scenario=empty");
  for (const meter of await page.locator(".d-margin-breakdown meter").all()) {
    await expect(meter).toHaveAttribute("value", "0");
    await expect(meter).toHaveAttribute("max", "1");
  }
});

test("ledger attributes venues and opens funding and transfer details without inventing orders", async ({
  page,
}) => {
  await page.goto("/demo?view=activity");
  await expect(
    page.locator('.d-events [data-event-id="EX-104"] .d-event-venue'),
  ).toHaveText("Pacifica");
  await expect(
    page.locator('.d-events [data-event-id="AG-103"] .d-event-venue'),
  ).toHaveText("Cinder");
  await page
    .getByRole("button", { name: "TR-101 · View event details" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Deposit credited");
  await expect(dialog).toContainText("+1,000.00 USDC");
  await expect(dialog).not.toContainText("EX-");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "TR-101 · View event details" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Funding", exact: true }).click();
  await page.locator(".d-events .d-event-inspect").first().click();
  await expect(dialog).toContainText("Funding");
  await expect(dialog).not.toContainText("EX-");
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

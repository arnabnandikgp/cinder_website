import { mockWallet, connectWallet } from "./helpers/wallet";
import { expect, test } from "@playwright/test";
import { chooseVenue } from "./helpers/venue-select";
import AxeBuilder from "@axe-core/playwright";
import { mockMarketData } from "./helpers/market-data";
import { strategies, type Strategy } from "../src/components/demo/strategies";

test.beforeEach(async ({ page }) => {
  await mockWallet(page);
});

test.beforeEach(async ({ page }) => {
  await mockMarketData(page, { stream: true });
});

test("venue-first ticket has prominent types, live price shortcuts and a static Cross label", async ({
  page,
}) => {
  await page.goto("/demo");
  await connectWallet(page);
  await expect(page.getByTestId("book-status")).toHaveText("Live");
  const venue = await page.getByLabel("Execution venue").boundingBox();
  const type = await page
    .getByRole("radio", { name: "Market", exact: true })
    .locator("..")
    .boundingBox();
  const direction = await page
    .getByRole("radio", { name: "Buy / Long" })
    .locator("..")
    .boundingBox();
  expect(venue!.y).toBeLessThan(type!.y);
  expect(type!.y).toBeLessThan(direction!.y);
  await page.getByRole("button", { name: "Bid", exact: true }).click();
  const bid = Number(
    await page.getByLabel("Limit price", { exact: true }).inputValue(),
  );
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  expect(
    Number(await page.getByLabel("Limit price", { exact: true }).inputValue()),
  ).toBeGreaterThan(bid);
  await chooseVenue(page, "Execution venue", "bulk");
  await expect(page.getByTestId("manual-chart-source")).toHaveText("BULK");
  const margin = page.locator(".d-margin-context");
  await expect(margin).toHaveText("Cross");
  expect(await margin.evaluate((element) => element.tagName)).toBe("DIV");
  expect(
    await margin.evaluate((element) => (element as HTMLElement).tabIndex),
  ).toBe(-1);
  await expect(margin.locator("button, summary, select, input")).toHaveCount(0);
  await expect(margin).toHaveCSS("cursor", "default");
  await expect(page.getByLabel("Size in", { exact: true })).toHaveCount(0);
  await expect(page.locator(".d-field-size .d-amount-input > span")).toHaveText(
    "USDC",
  );
  await page.getByLabel("Order size", { exact: true }).fill("306");
  await chooseVenue(page, "Execution venue", "pacifica");
  await expect(page.getByLabel("Order size", { exact: true })).toHaveValue(
    "306",
  );
  await page
    .getByRole("button", { name: "Place buy order", exact: true })
    .click();
  await expect(page.locator(".d-paper-table")).toContainText("Open");
  await expect(page.locator(".d-feedback-note")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

for (const kind of [
  "Scale",
  "Chase",
  "TWAP",
  "VWAP",
  "Chase TWAP",
  "Iceberg",
  "Swarm",
]) {
  test(`${kind} can be configured and saved as a local plan`, async ({
    page,
  }) => {
    const writes: string[] = [];
    page.on("request", (r) => {
      if (!["GET", "HEAD"].includes(r.method())) writes.push(r.url());
    });
    await page.goto("/demo");
    await connectWallet(page);
    await expect(page.getByTestId("book-status")).toHaveText("Live");
    await page
      .getByRole("button", { name: "Advanced order types", exact: true })
      .click();
    await page
      .getByRole("menuitemradio", {
        name: `${kind} ${strategies[kind as Strategy]}`,
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("region", { name: "Strategy plan", exact: true }),
    ).toContainText(`${kind} plan`);
    await expect(
      page.locator(".d-field-size .d-amount-input > span"),
    ).toHaveText("USDC");
    const plan = page.getByRole("region", {
      name: "Strategy plan",
      exact: true,
    });
    await expect(plan).toContainText("300.00 USDC");
    if (kind !== "Chase") {
      await plan.locator("summary").click();
      await expect(
        plan.getByRole("columnheader", { name: "Size (USDC)", exact: true }),
      ).toBeVisible();
      const amounts = await plan
        .locator("tbody tr td:last-child")
        .allTextContents();
      expect(
        amounts.reduce(
          (sum, value) => sum + Number(value.replaceAll(",", "")),
          0,
        ),
      ).toBeCloseTo(300, 6);
    }
    await page
      .getByRole("button", { name: "Schedule paper plan", exact: true })
      .click();
    await expect(page.locator(".d-paper-table")).toContainText(
      "Scheduled plan",
    );
    await page.locator(".d-paper-table .d-cell-link").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Pacifica");
    await expect(dialog).toContainText("$300.00");
    const saved = await dialog
      .getByRole("region", { name: "Strategy plan" })
      .innerText();
    await page.keyboard.press("Escape");
    await page.getByLabel("Order size", { exact: true }).fill("4");
    await page.getByRole("button", { name: "Activity", exact: true }).click();
    await expect(page.locator(".d-events")).toContainText(
      `${kind} · funds reserved locally`,
    );
    await expect(page.locator(".d-events")).toContainText("300.00 USDC");
    await page.locator(".d-event-inspect").first().click();
    await expect(dialog).toContainText("Scheduled plan");
    expect(
      await dialog.getByRole("region", { name: "Strategy plan" }).innerText(),
    ).toBe(saved);
    await expect(dialog).not.toContainText("Maximum slippage");
    expect(writes).toEqual([]);
  });
}

test("strategy menu is keyboard operable and both mode drafts survive round trips", async ({
  page,
}) => {
  await page.goto("/demo");
  await connectWallet(page);
  await expect(page.getByTestId("book-status")).toHaveText("Live");
  const trigger = page.getByRole("button", { name: /Advanced order types/ });
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitemradio", { name: /^Scale / }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(trigger).toBeFocused();
  await expect(trigger).toContainText("TWAP");
  await page.getByLabel("Duration (minutes)", { exact: true }).fill("10");
  await page.getByRole("radio", { name: "Pro", exact: true }).check();
  await expect(page.getByRole("button", { name: /Smart route/ })).toContainText(
    "3 included venues",
  );
  await expect(trigger).toHaveCount(0);
  await page.getByLabel("Order size", { exact: true }).fill("65");
  await page.getByRole("radio", { name: "Standard", exact: true }).check();
  await expect(trigger).toContainText("TWAP");
  await expect(
    page.getByLabel("Duration (minutes)", { exact: true }),
  ).toHaveValue("10");
  await page.getByLabel("Order size", { exact: true }).fill("3");
  await page.getByRole("radio", { name: "Pro", exact: true }).check();
  await expect(page.getByLabel("Order size", { exact: true })).toHaveValue(
    "65",
  );
  await page.getByRole("radio", { name: "Standard", exact: true }).check();
  await trigger.click();
  await expect(
    page.getByRole("menuitemradio", { name: /^TWAP / }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("menu")).toHaveCount(0);
});

for (const market of ["SOL", "BTC"]) {
  test(`${market} Market and Limit keep USDC exposure when price, venue and leverage change`, async ({
    page,
  }) => {
    await page.goto(`/demo?market=${market}`);
    await connectWallet(page);
    await expect(page.getByTestId("book-status")).toHaveText("Live");
    const size = page.getByLabel("Order size", { exact: true });
    await size.fill("1000.25");
    await page
      .getByLabel("Limit price", { exact: true })
      .fill(market === "SOL" ? "200" : "85000");
    await page.getByLabel("Leverage", { exact: true }).selectOption("5");
    await expect(size).toHaveValue("1000.25");
    await chooseVenue(page, "Execution venue", "bulk");
    await expect(size).toHaveValue("1000.25");
    await page
      .getByRole("button", { name: "Place buy order", exact: true })
      .click();
    await page.getByRole("tab", { name: "Order history" }).click();
    await expect(page.locator(".d-paper-table")).toContainText("1,000.25");
    await expect(page.locator(".d-feedback-note")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("radio", { name: "Market", exact: true }).check();
    await page.getByRole("button", { name: /Set maximum slippage/ }).click();
    await page.getByLabel("Custom percentage").fill("1");
    await page.getByRole("button", { name: "Save slippage" }).click();
    await expect(
      page.locator(".d-field-size .d-amount-input > span"),
    ).toHaveText("USDC");
    await page
      .getByRole("button", { name: "Place buy order", exact: true })
      .click();
    await expect(page.locator(".d-paper-table")).toContainText("Long");
    await expect(page.locator(".d-feedback-note")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("region", { name: "Market chart", exact: true })
      .getByLabel("Market", { exact: true })
      .selectOption(market === "SOL" ? "BTC" : "SOL");
    await expect(size).toHaveValue("1000.25");
  });
}

test("invalid plan focuses the relevant field and Iceberg cannot retain IOC", async ({
  page,
}) => {
  await page.goto("/demo");
  await connectWallet(page);
  await expect(page.getByTestId("book-status")).toHaveText("Live");
  await page.getByLabel("Time in force").selectOption("IOC");
  await page.getByRole("button", { name: /Advanced order types/ }).click();
  await page.getByRole("menuitemradio", { name: /^Iceberg / }).click();
  await expect(page.getByLabel("Time in force")).toHaveValue("GTC");
  await page.getByLabel("Displayed size (USDC)").fill("301");
  await page.getByRole("button", { name: "Schedule paper plan" }).click();
  await expect(page.getByLabel("Displayed size (USDC)")).toBeFocused();
  await expect(page.getByLabel("Displayed size (USDC)")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

for (const width of [375, 768, 1280, 1440]) {
  test(`advanced order ticket is accessible at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/demo");
    await connectWallet(page);
    await expect(page.getByTestId("book-status")).toHaveText("Live");
    const margin = await page.locator(".d-margin-context").boundingBox();
    const leverage = await page
      .getByLabel("Leverage", { exact: true })
      .boundingBox();
    expect(Math.abs(margin!.y - leverage!.y)).toBeLessThan(2);
    await page.screenshot({
      path: info.outputPath("standard.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: /Advanced order types/ }).click();
    let audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    await page.getByRole("menuitemradio", { name: /^Scale / }).click();
    await page
      .getByRole("region", { name: "Strategy plan" })
      .locator("summary")
      .click();
    audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    // Axe may leave its focus probe on the global skip link. Return the
    // screenshot to a neutral state without changing the UI's focus behaviour.
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.screenshot({
      path: info.outputPath("scale.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Schedule paper plan" }).click();
    await expect(page.locator(".d-paper-table")).toContainText(
      "Scheduled plan",
    );
    await page.locator(".d-paper-table .d-cell-link").first().click();
    await expect(page.getByRole("dialog")).toContainText("Scale plan");
    audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(audit.violations.map((v) => v.id)).toEqual([]);
  });
}

import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("order book depth accumulates outward on both sides of the spread", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/demo");
  for (const [side, ascending] of [
    ["ask", false],
    ["bid", true],
  ] as const) {
    const rows = await page.locator(`.d-${side}`).evaluateAll((nodes) =>
      nodes.map((node) => ({
        width: parseFloat(node.querySelector("i")!.style.width),
        cells: Array.from(node.querySelectorAll("span")).map((span) =>
          Number(span.textContent!.replaceAll(",", "")),
        ),
      })),
    );
    expect(rows).toHaveLength(8);
    const insideOut = ascending ? rows : [...rows].reverse();
    let runningTotal = 0;
    for (let i = 0; i < insideOut.length; i++) {
      runningTotal += insideOut[i].cells[1];
      expect(insideOut[i].cells[2]).toBeCloseTo(runningTotal, 1);
      if (i) expect(insideOut[i].width).toBeGreaterThan(insideOut[i - 1].width);
    }
    for (let i = 1; i < rows.length; i++)
      expect(rows[i].cells[0]).toBeLessThan(rows[i - 1].cells[0]);
  }
});

test("leverage and directional colors follow the order without executing it", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(
    page.getByLabel("Order leverage 25x", { exact: true }),
  ).toHaveText("25x");
  await page.getByLabel("Leverage", { exact: true }).selectOption("10");
  await expect(
    page.getByLabel("Order leverage 10x", { exact: true }),
  ).toHaveText("10x");
  await page.getByRole("radio", { name: "Sell / Short" }).check();
  const review = page.getByRole("button", { name: "Review sell order" });
  await expect(review).toHaveClass(/d-sell-action/);
  await review.click();
  await expect(page.getByRole("dialog")).toContainText("10x");
  await expect(page.getByRole("dialog")).toContainText(
    "local draft, not an order",
  );
  await page.keyboard.press("Escape");
  const workspace = page.getByTestId("demo-workspace");
  await expect(workspace).not.toContainText(
    /Sample account|Review example|Synthetic|Sample day/,
  );
  await expect(page.locator(".d-demo-bar")).not.toContainText(
    "Interactive prototype",
  );
  await expect(page.locator(".d-demo-disclosure")).toContainText("simulated");
});

test("TradingView chart loads, responds to controls and changes market context", async ({
  page,
}) => {
  await page.goto("/demo");
  const chart = page.locator(".d-tv-chart");
  await expect(chart).toHaveAttribute("data-chart-status", "ready");
  expect(await chart.locator("canvas").count()).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Zoom in chart" }).click();
  await chart.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Home");
  await page.getByRole("button", { name: "1h", exact: true }).click();
  await expect(chart).toHaveAttribute("data-chart-key", "SOL-pacifica-1h");
  await expect(chart).toHaveAttribute("data-chart-status", "ready");
  await page
    .getByRole("combobox", { name: "Market", exact: true })
    .selectOption("BTC");
  await expect(chart).toHaveAttribute("data-chart-key", "BTC-pacifica-1h");
  await expect(chart).toHaveAttribute("data-chart-status", "ready");
  await expect(page.locator(".d-chart-attribution a")).toHaveAttribute(
    "href",
    "https://www.tradingview.com/",
  );
});

for (const view of ["account", "activity"]) {
  test(`${view} is accessible on mobile`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto(`/demo?view=${view}`);
    await expect(page.locator(".d-header")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(audit.violations.map((violation) => violation.id)).toEqual([]);
  });
}

for (const width of [375, 768, 1280, 1440]) {
  test(`chart-first demo is accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("/demo");
    await expect(page.locator(".d-tv-chart")).toHaveAttribute(
      "data-chart-status",
      "ready",
    );
    await expect(
      page.getByRole("heading", { name: "Cinder trading workspace" }),
    ).toBeAttached();
    await expect(
      page.getByRole("radio", { name: "Choose venue", exact: true }),
    ).toBeChecked();
    await expect(
      page.getByRole("button", { name: /account-first|hybrid/i }),
    ).toHaveCount(0);
    await expect(page.locator("meta[name=robots]")).toHaveAttribute(
      "content",
      /noindex/,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("chart, execution venue and record scope stay independent", async ({
  page,
}) => {
  await page.goto("/demo");
  await page
    .getByLabel("Execution venue", { exact: true })
    .selectOption("bulk");
  await expect(page.getByLabel("Chart source")).toHaveValue("pacifica");
  await expect(page.getByLabel("Venue", { exact: true })).toHaveValue("bulk");
  await page.getByLabel("Chart source").selectOption("velocity");
  await expect(page.getByLabel("Execution venue", { exact: true })).toHaveValue(
    "bulk",
  );
  await expect(page.getByLabel("Venue", { exact: true })).toHaveValue("bulk");
  await page.getByRole("tab", { name: "Trade history", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText("FL-203");
  await expect(page.getByRole("tabpanel")).not.toContainText("FL-202");
  await page.getByRole("radio", { name: "Auto-route", exact: true }).check();
  await expect(page.getByLabel("Venue", { exact: true })).toHaveValue("all");
  await expect(page.getByLabel("Chart source")).toHaveValue("velocity");
  await expect(page.getByRole("tabpanel")).toContainText("FL-202");
});

test("all five record tabs, keyboard navigation and URL restoration work", async ({
  page,
}) => {
  await page.goto("/demo");
  const tabs = page.getByRole("tablist", { name: "Trading records" });
  await expect(tabs.getByRole("tab")).toHaveCount(5);
  await tabs.getByRole("tab", { name: /Positions/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab", { name: /Open orders/ })).toBeFocused();
  await expect(page.getByRole("tabpanel")).toContainText("EX-104");
  await page.keyboard.press("End");
  await expect(
    tabs.getByRole("tab", { name: "Funding history" }),
  ).toBeFocused();
  await expect(page.getByRole("tabpanel")).toContainText("−0.36");
  await page.reload();
  await expect(
    tabs.getByRole("tab", { name: "Funding history" }),
  ).toHaveAttribute("aria-selected", "true");
  await tabs.getByRole("tab", { name: "Order history" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("EX-102");
});

test("order validation, draft review and account-wide Activity remain coherent", async ({
  page,
}) => {
  await page.goto("/demo");
  const size = page.getByLabel("Order size", { exact: true });
  await size.fill("0");
  await page
    .getByRole("button", { name: "Review buy order", exact: true })
    .click();
  await expect(size).toBeFocused();
  await expect(size).toHaveAttribute("aria-invalid", "true");
  await size.fill("3");
  const review = page.getByRole("button", {
    name: "Review buy order",
    exact: true,
  });
  await review.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Buy 3 SOL");
  await expect(dialog).toContainText("Not calculated");
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations.map((violation) => violation.id)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(review).toBeFocused();
  await review.click();
  await dialog.getByRole("button", { name: "Save example draft" }).click();
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("button", { name: "Activity", exact: true })
    .click();
  await page.getByRole("button", { name: /Drafts/ }).click();
  await expect(page.locator(".d-events")).toContainText("DRAFT-1");
  await expect(page.locator(".d-events")).toContainText("Not submitted");
  await page.getByRole("button", { name: "DRAFT-1 · View details" }).click();
  await expect(dialog).toContainText("Buy 3 SOL");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Funding", exact: true }).click();
  await expect(page.locator(".d-events")).toContainText("−0.36 USDC");
  await expect(page.locator(".d-events")).toContainText("+0.12 USDC");
  await page.getByRole("button", { name: "Trade", exact: true }).click();
  await expect(size).toHaveValue("3");
});

test("future routing validates allowed venues and market slippage without producing a route", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.getByRole("radio", { name: "Auto-route", exact: true }).check();
  await expect(page.locator(".d-route-note")).toContainText("Future concept");
  await page.getByRole("button", { name: /Allowed venues/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: "Pacifica" }).uncheck();
  await dialog.getByRole("checkbox", { name: "BULK" }).uncheck();
  await dialog.getByRole("button", { name: "Save preferences" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Choose at least one");
  await dialog.getByRole("checkbox", { name: "Velocity" }).check();
  await dialog.getByRole("button", { name: "Save preferences" }).click();
  await page.getByRole("radio", { name: "Market", exact: true }).check();
  await page
    .getByRole("button", { name: "Review buy order", exact: true })
    .click();
  await expect(page.getByLabel("Maximum slippage")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Maximum slippage").fill("0.5");
  await page
    .getByRole("button", { name: "Review buy order", exact: true })
    .click();
  await expect(dialog).toContainText("Velocity");
  await expect(dialog).toContainText("Not calculated");
  await expect(dialog).toContainText("0.5%");
});

test("partial-fill cancellation preserves fills and waits for explicit sample confirmation", async ({
  page,
}) => {
  await page.goto("/demo?scenario=partial&record=orders");
  await expect(page.getByRole("tabpanel")).toContainText("2 / 5 SOL");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Simulate cancellation request" })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tabpanel")).toContainText("Cancel requested");
  await page.getByRole("button", { name: "View request" }).click();
  await page
    .getByRole("button", { name: "Load sample cancellation confirmation" })
    .click();
  await expect(page.getByRole("tabpanel")).toContainText("No open orders");
  await page
    .getByRole("button", { name: "View cancelled order in history" })
    .click();
  await expect(page.getByRole("tabpanel")).toContainText("3 SOL cancelled");
  await page.getByRole("tab", { name: "Trade history", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText("FL-204");
  await expect(page.getByRole("tabpanel")).toContainText("Pending");
});

test("account balances and reduction previews do not mutate positions or transfer funds", async ({
  page,
}) => {
  await page.goto("/demo?view=account");
  await expect(
    page.getByRole("heading", { name: "Capital, with context." }),
  ).toBeVisible();
  await expect(page.locator(".d-capital-grid")).toContainText("12,024.00");
  await expect(page.locator(".d-capital-grid")).toContainText("5,000.00 USDC");
  await page
    .getByRole("button", { name: "Reduce", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Preview reduction" }).click();
  await expect(page.getByRole("dialog")).toContainText("Remaining: 4.00 SOL");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tabpanel")).toContainText("8 SOL");
  await page.getByRole("button", { name: "Withdraw preview" }).click();
  await page.getByLabel("Withdrawal amount (USDC)").fill("5001");
  await page.getByRole("button", { name: "Preview withdrawal" }).click();
  await expect(page.getByLabel("Withdrawal amount (USDC)")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});

test("empty, stale and pending-deposit sample states remain distinguishable", async ({
  page,
}) => {
  await page.goto("/demo?scenario=empty");
  await expect(page.getByRole("tabpanel")).toContainText(
    "empty sample account",
  );
  await page.getByLabel("Demo scenario").selectOption("stale");
  await expect(
    page.getByRole("button", { name: "Review buy order", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("tabpanel")).toContainText("8 SOL");
  await page.getByRole("button", { name: "Restore sample" }).click();
  await expect(
    page.getByRole("button", { name: "Review buy order", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Demo scenario").selectOption("deposit");
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.locator(".d-account-context")).toContainText(
    "awaiting account credit",
  );
});

test("reset, feedback and modal keyboard behavior work without external writes", async ({
  page,
}) => {
  const writes: string[] = [];
  const external: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url());
    if (
      new URL(request.url()).hostname !==
      new URL(test.info().project.use.baseURL as string).hostname
    )
      external.push(request.url());
  });
  await page.goto("/demo?mode=auto&view=activity");
  await page.getByRole("button", { name: "Give feedback" }).click();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "Open Cinder on X" }),
  ).toHaveAttribute("href", "https://x.com/CinderExchange");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Give feedback" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Reset demo" }).click();
  await page.getByRole("button", { name: "Reset sample account" }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(
    page.getByRole("radio", { name: "Choose venue", exact: true }),
  ).toBeChecked();
  expect(writes).toEqual([]);
  expect(external).toEqual([]);
});

import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockMarketData } from "./helpers/market-data";

test.beforeEach(async ({ page }) => {
  await mockMarketData(page, { stream: true });
});

for (const width of [375, 768, 1001, 1280]) {
  test(`workspace switcher is prominent and keyboard accessible at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/demo");
    const navigation = page.getByRole("navigation", {
      name: "Workspace navigation",
    });
    const trade = navigation.getByRole("button", {
      name: "Trade",
      exact: true,
    });
    const account = navigation.getByRole("button", {
      name: "Account",
      exact: true,
    });
    const activity = navigation.getByRole("button", {
      name: "Activity",
      exact: true,
    });
    await expect(trade).toHaveAttribute("aria-current", "page");
    await expect(trade).toHaveCSS("background-color", "rgb(0, 81, 254)");
    await expect(account).toHaveAccessibleDescription("Balances & positions");
    await expect(activity).toHaveAccessibleDescription("Fills, fees & funding");
    const actions = await page.locator(".d-account-actions").boundingBox();
    const navBox = await navigation.boundingBox();
    expect(
      navBox!.y >= actions!.y + actions!.height ||
        navBox!.x + navBox!.width <= actions!.x,
    ).toBe(true);
    for (const button of [trade, account, activity]) {
      await expect(button).toBeInViewport();
      const box = await button.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    await trade.focus();
    await page.keyboard.press("Tab");
    await expect(account).toBeFocused();
    await expect(account).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Enter");
    await expect(account).toHaveAttribute("aria-current", "page");
    await expect(account).toHaveCSS("background-color", "rgb(0, 81, 254)");
    await expect(trade).not.toHaveAttribute("aria-current", "page");
    await page.keyboard.press("Tab");
    await expect(activity).toBeFocused();
    await page.keyboard.press("Space");
    await expect(activity).toHaveAttribute("aria-current", "page");
    await expect(page).toHaveURL(/view=activity/);
    await page.goBack();
    await expect(account).toHaveAttribute("aria-current", "page");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

for (const [width, height] of [
  [1280, 720],
  [1440, 900],
  [1920, 1080],
]) {
  test(`desktop workspace fills ${width}×${height} without outer margins`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/demo");
    await expect(page.locator(".d-tv-chart")).toHaveAttribute(
      "data-chart-status",
      "ready",
    );
    const workspace = page.getByTestId("demo-workspace");
    const box = await workspace.boundingBox();
    expect(box).toEqual({ x: 0, y: 0, width, height });
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBe(height);
    await expect(
      page.locator(".d-demo-disclosure, .d-review-tools, .d-workspace-footer"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Reset demo|Give feedback/ }),
    ).toHaveCount(0);
    await expect(page.getByLabel("Demo scenario")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "About Cinder" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "About this demo" }),
    ).toHaveCount(0);
    for (const selector of [
      ".d-header",
      ".d-market",
      ".d-book",
      ".d-ticket",
      ".d-records",
    ]) {
      const panel = await page.locator(selector).boundingBox();
      expect(panel!.y).toBeGreaterThanOrEqual(0);
      expect(panel!.y + panel!.height).toBeLessThanOrEqual(height);
    }
    const records = await page.locator(".d-records").boundingBox();
    expect(records!.height).toBeGreaterThanOrEqual(256);
    const tablePanel = await page.locator("#records-panel").boundingBox();
    const firstPosition = await page
      .locator("#records-panel tbody tr")
      .first()
      .boundingBox();
    expect(firstPosition!.y + firstPosition!.height).toBeLessThanOrEqual(
      tablePanel!.y + tablePanel!.height,
    );
    const chart = await page.locator(".d-chart-frame").boundingBox();
    expect(chart!.height).toBeGreaterThanOrEqual(130);
    // Long forms and records remain reachable without scrolling the workspace out of view.
    await page.getByRole("button", { name: "Review buy order" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await page.getByRole("tab", { name: "Trade history" }).click();
    const lastFill = page.locator("#records-panel tbody tr").last();
    await lastFill.scrollIntoViewIfNeeded();
    await expect(lastFill).toBeInViewport();
    expect(await page.evaluate(() => scrollY)).toBe(0);
    for (const view of ["Account", "Activity"]) {
      await page
        .getByRole("navigation", { name: "Workspace navigation" })
        .getByRole("button", { name: view, exact: true })
        .click();
      expect(await workspace.boundingBox()).toEqual({
        x: 0,
        y: 0,
        width,
        height,
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollHeight),
      ).toBe(height);
    }
  });
}

test("short tablet viewports keep natural scrolling and a readable chart", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 640 });
  await page.goto("/demo");
  await expect(page.locator(".d-tv-chart")).toHaveAttribute(
    "data-chart-status",
    "ready",
  );
  const chart = await page.locator(".d-chart-frame").boundingBox();
  expect(chart!.height).toBeGreaterThanOrEqual(300);
  const workspace = await page.getByTestId("demo-workspace").boundingBox();
  expect(workspace!.height).toBeGreaterThan(640);
  await page.getByRole("button", { name: "Review buy order" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("order book depth accumulates outward on both sides of the spread", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/demo");
  await expect(page.locator(".d-bid")).toHaveCount(8);
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
  await expect(page.locator(".d-demo-bar")).toHaveCount(0);
  await expect(page.locator(".d-demo-disclosure")).toHaveCount(0);
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
  const credit = page.locator(".d-chart-credit summary");
  await credit.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".d-chart-credit > div")).toBeVisible();
  await expect(page.locator(".d-chart-credit")).toContainText(
    "Copyright (с) 2025 TradingView, Inc.",
  );
  await expect(page.locator(".d-chart-credit a")).toHaveAttribute(
    "href",
    "https://www.tradingview.com/",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".d-chart-credit > div")).toBeHidden();
  await expect(credit).toBeFocused();
});

test("chart credit stays accessible on mobile without adding a page footer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/demo");
  await expect(page.locator(".d-tv-chart")).toHaveAttribute(
    "data-chart-status",
    "ready",
  );
  await page.locator(".d-chart-credit summary").click();
  const notice = page.locator(".d-chart-credit > div");
  await expect(notice).toBeInViewport();
  const box = await notice.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  await expect(
    notice.getByRole("link", { name: "TradingView", exact: true }),
  ).toBeVisible();
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations.map((violation) => violation.id)).toEqual([]);
  await page.keyboard.press("Escape");
  const workspace = await page.getByTestId("demo-workspace").boundingBox();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    Math.ceil(workspace!.height),
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
      page.getByRole("radio", { name: "Standard", exact: true }),
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

test("manual chart follows execution and auto-route allows an independent reference", async ({
  page,
}) => {
  await page.goto("/demo");
  await page
    .getByLabel("Execution venue", { exact: true })
    .selectOption("bulk");
  await expect(
    page.getByRole("combobox", { name: "Chart source" }),
  ).toHaveCount(0);
  await expect(page.getByTestId("manual-chart-source")).toHaveText("BULK");
  await expect(page.locator(".d-tv-chart")).toHaveAttribute(
    "data-chart-key",
    "SOL-bulk-15m",
  );
  await expect(page.locator(".d-book .d-panel-title")).toContainText("BULK");
  await expect(page.getByLabel("Venue", { exact: true })).toHaveValue("bulk");
  await page.getByRole("tab", { name: "Trade history", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText("FL-203");
  await expect(page.getByRole("tabpanel")).not.toContainText("FL-202");
  await page.getByRole("radio", { name: "Pro", exact: true }).check();
  await page.getByRole("tab", { name: "Price chart", exact: true }).click();
  await expect(page.getByLabel("Venue", { exact: true })).toHaveValue("all");
  await expect(page.getByLabel("Chart source")).toHaveValue("bulk");
  await page.getByLabel("Chart source").selectOption("velocity");
  await expect(page.getByLabel("Chart source")).toHaveValue("velocity");
  await expect(page.locator(".d-tv-chart")).toHaveAttribute(
    "data-chart-key",
    "SOL-velocity-15m",
  );
  await expect(page.getByLabel("Venue", { exact: true })).toHaveValue("all");
  await expect(page.locator("#records-panel")).toContainText("FL-202");
  await page.reload();
  await expect(page.getByLabel("Chart source")).toHaveValue("velocity");
  await page.getByRole("radio", { name: "Standard", exact: true }).check();
  await expect(
    page.getByRole("combobox", { name: "Chart source" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Execution venue", { exact: true })).toHaveValue(
    "bulk",
  );
  await expect(page.getByTestId("manual-chart-source")).toHaveText("BULK");
  await expect(page.locator(".d-tv-chart")).toHaveAttribute(
    "data-chart-key",
    "SOL-bulk-15m",
  );
  await page.getByLabel("Venue", { exact: true }).selectOption("pacifica");
  await expect(page.getByTestId("manual-chart-source")).toHaveText("BULK");
  await page.goto("/demo?mode=manual&venue=velocity&chart=pacifica");
  await expect(page.getByTestId("manual-chart-source")).toHaveText("Velocity");
  await expect(page.locator(".d-tv-chart")).toHaveAttribute(
    "data-chart-key",
    "SOL-velocity-15m",
  );
});

test("margin breakdown reconciles with venue-scoped positions and empty accounts", async ({
  page,
}) => {
  await page.goto("/demo?view=account&scope=all");
  await expect(page.getByTestId("margin-committed")).toHaveText(
    "2,600.00 USDC",
  );
  for (const [venue, amount, position] of [
    ["pacifica", "800.00", "SOL-PERP"],
    ["bulk", "1,800.00", "BTC-PERP"],
    ["velocity", "0.00", ""],
  ]) {
    const allocation = page.getByTestId(`margin-${venue}`);
    await expect(allocation.locator("dd")).toHaveText(`${amount} USDC`);
    await expect(allocation).toContainText(
      position ? "1 open position" : "No open positions",
    );
    await page.getByLabel("Venue", { exact: true }).selectOption(venue);
    if (position) {
      await expect(page.locator(".d-records tbody tr")).toHaveCount(1);
      await expect(page.getByRole("tabpanel")).toContainText(position);
    } else {
      await expect(page.getByRole("tabpanel")).toContainText("No positions");
    }
    await expect(page.getByTestId("margin-committed")).toHaveText(
      "2,600.00 USDC",
    );
  }
  const amounts = await page
    .locator(".d-margin-breakdown dd")
    .allTextContents();
  const sum = amounts.reduce(
    (total, text) =>
      total + Number(text.replaceAll(",", "").replace(" USDC", "")),
    0,
  );
  expect(sum).toBe(2600);
  await page.getByLabel("Venue", { exact: true }).selectOption("bulk");
  await page.getByRole("button", { name: "Reduce", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("BULK");
  await page.keyboard.press("Escape");
  await page.goto("/demo?view=account&scenario=empty");
  await expect(page.getByTestId("margin-committed")).toHaveText("0.00 USDC");
  await expect(page.locator(".d-margin-breakdown dd")).toHaveText([
    "0.00 USDC",
    "0.00 USDC",
    "0.00 USDC",
  ]);
  await expect(page.locator(".d-margin-breakdown")).not.toContainText(
    "1 open position",
  );
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
  await expect(dialog).toContainText("Buy 3.00 USDC");
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
  await expect(dialog).toContainText("Buy 3.00 USDC");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Funding", exact: true }).click();
  await expect(page.locator(".d-events")).toContainText("−0.36 USDC");
  await expect(page.locator(".d-events")).toContainText("+0.12 USDC");
  await page.getByRole("button", { name: "Trade", exact: true }).click();
  await expect(size).toHaveValue("3");
});

test("Pro validates compared venues and tolerance before reviewing a local draft", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.getByRole("radio", { name: "Pro", exact: true }).check();
  await expect(page.getByTestId("route-card")).toContainText(
    "Venue-only estimate",
  );
  await page.getByRole("button", { name: /Allowed venues/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: "Pacifica" }).uncheck();
  await dialog.getByRole("checkbox", { name: "BULK" }).uncheck();
  await dialog.getByRole("button", { name: "Save preferences" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Choose at least one");
  await dialog.getByRole("checkbox", { name: "BULK" }).check();
  await dialog.getByRole("button", { name: "Save preferences" }).click();
  await page.getByLabel("Price tolerance").fill("");
  await expect(
    page.getByRole("button", { name: "Review buy order", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Price tolerance").fill("0.5");
  await page
    .getByRole("button", { name: "Review buy order", exact: true })
    .click();
  await expect(dialog).toContainText("BULK");
  await expect(dialog).toContainText("Total estimated entry cost");
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
  await page.goto("/demo?scenario=stale");
  await expect(
    page.getByRole("button", { name: "Review buy order", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("tabpanel")).toContainText("8 SOL");
  await page.getByRole("button", { name: "Restore sample" }).click();
  await expect(
    page.getByRole("button", { name: "Review buy order", exact: true }),
  ).toBeEnabled();
  await page.goto("/demo?scenario=deposit");
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.locator(".d-account-context")).toContainText(
    "awaiting account credit",
  );
});

test("funding dialogs keep prototype safeguards and keyboard behavior without external writes", async ({
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
  await page.goto("/demo");
  const deposit = page.getByRole("button", { name: "Deposit", exact: true });
  await deposit.click();
  await expect(page.getByRole("dialog")).toContainText(
    "Demo only. Do not send funds.",
  );
  await expect(
    page.getByRole("button", { name: "Close dialog" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(deposit).toBeFocused();
  expect(writes).toEqual([]);
  expect(
    external.every((url) =>
      /^https:\/\/api\.pacifica\.fi\/api\/v1\/(info|kline)(\?|$)/.test(url),
    ),
  ).toBe(true);
});

import { mockWallet, connectWallet } from "./helpers/wallet";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bookMessage, mockMarketData } from "./helpers/market-data";

test.beforeEach(async ({ page }) => {
  await mockWallet(page);
});

test("Live is default; graph and table publish together rather than on every message", async ({
  page,
}) => {
  const data = await mockMarketData(page, { stream: true, phoenix: true });
  await page.goto("/demo?mode=auto");
  const selector = page.getByRole("group", { name: "Comparison sampling" });
  await expect(
    selector.getByRole("button", { name: "Live", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("curve-phoenix")).toHaveCount(1);
  const socket = data.sockets.find((s) => s.venue === "pacifica" && !s.closed)!;
  socket.paused = true;
  let sends = 0;
  const timer = setInterval(() => {
    if (!page.isClosed())
      socket.socket.send(
        JSON.stringify(
          bookMessage("pacifica", "SOL", 152 + 0.01 * (++sends % 10)),
        ),
      );
  }, 40);
  try {
    const readings = await page.evaluate(async () => {
      const readings: {
        graph: string | null;
        table: string | null;
        value: string | null;
      }[] = [];
      for (let i = 0; i < 50; i++) {
        readings.push({
          graph: document
            .querySelector(".d-cost-svg")!
            .getAttribute("data-published-at"),
          table: document
            .querySelector(".d-comparison-table")!
            .getAttribute("data-published-at"),
          value: document
            .querySelector('[data-testid="route-row-pacifica"] .d-entry-cost')!
            .getAttribute("data-cost-bps"),
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return readings;
    });
    expect(readings.every((r) => r.graph === r.table)).toBe(true);
    const frames = [...new Set(readings.map((r) => r.graph))];
    expect(frames.length).toBeGreaterThan(1);
    expect(frames.length).toBeLessThanOrEqual(4);
    for (const frame of frames)
      expect(
        new Set(readings.filter((r) => r.graph === frame).map((r) => r.value))
          .size,
      ).toBe(1);
  } finally {
    clearInterval(timer);
  }
});

test("average warms up, reconciles chart and table, supports keyboard and persists its view in URL", async ({
  page,
}) => {
  await mockMarketData(page, {
    stream: true,
    phoenix: true,
    bookCadenceMs: { pacifica: 100, bulk: 350, phoenix: 1000 },
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo?mode=auto");
  const average = page.getByRole("button", { name: "5s average", exact: true });
  await average.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/analysis=average/);
  await expect(average).toBeFocused();
  await expect(page.getByTestId("analysis-status")).toHaveText(
    "Collecting 5s average",
  );
  await expect(page.getByTestId("analysis-status")).toContainText(
    "paired samples",
    { timeout: 9000 },
  );
  await expect(page.getByTestId("route-row-bulk")).toContainText(
    "Lowest 5s average",
  );
  await expect(page.locator(".d-route-card-heading")).toContainText(
    "Best now · live estimate",
  );
  await expect(page.locator(".d-analysis-ticket-note")).toHaveText(
    "Ticket uses live books",
  );
  await expect(page.getByTestId("curve-phoenix")).toHaveCount(1);
  const values = await page
    .getByTestId("route-row-pacifica")
    .locator(".d-cost-bps")
    .allTextContents();
  const [price, fee, total] = values.map((v) =>
    Number(v.replace(/bps|,/g, "").trim()),
  );
  expect(Math.abs(price + fee - total)).toBeLessThanOrEqual(0.011);
  expect(
    await page.locator(".d-cost-svg").getAttribute("data-published-at"),
  ).toBe(
    await page.locator(".d-comparison-table").getAttribute("data-published-at"),
  );
  await page.screenshot({
    path: "/private/tmp/cinder-pro-5s-average-desktop.png",
  });
  expect(
    (await new AxeBuilder({ page }).include(".d-pro-workspace").analyze())
      .violations,
  ).toEqual([]);
  await page.reload();
  await expect(average).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("analysis-status")).toHaveText(
    "Collecting 5s average",
  );
});

test("average winner never drives live ticket or submission, and new size resets history", async ({
  page,
}) => {
  const data = await mockMarketData(page, { stream: true, phoenix: true });
  await page.goto("/demo?mode=auto&analysis=average");
  await connectWallet(page);
  await expect(page.getByTestId("route-row-bulk")).toContainText(
    "Lowest 5s average",
    { timeout: 9000 },
  );
  const bulk = data.sockets.find((s) => s.venue === "bulk" && !s.closed)!;
  bulk.paused = true;
  // Widen actual spread/depth, not the venue price offset. The old average
  // can prefer BULK while the fresh lower-friction route is now Pacifica.
  const timer = setInterval(() => {
    if (!page.isClosed())
      bulk.socket.send(
        JSON.stringify(bookMessage("bulk", "SOL", 153, Date.now(), true, 0.2)),
      );
  }, 150);
  try {
    bulk.socket.send(
      JSON.stringify(bookMessage("bulk", "SOL", 153, Date.now(), true, 0.2)),
    );
    await expect(page.getByTestId("recommended-venue")).toHaveText("Pacifica");
    await expect(page.getByTestId("route-row-bulk")).toContainText(
      "Lowest 5s average",
    );
    await page.getByRole("button", { name: "Place buy order" }).click();
    await expect(page.locator(".d-paper-table")).toContainText("Long");
    await expect(page.locator(".d-feedback-note")).toHaveCount(0);
    await expect(page.locator(".d-paper-table")).toContainText("Pacifica");
    await page.getByLabel("Order size", { exact: true }).fill("300");
    await expect(page.getByTestId("analysis-status")).toHaveText(
      "Collecting 5s average",
    );
    await expect(page.locator(".d-comparison-table .d-entry-cost")).toHaveCount(
      0,
    );
    await expect(page.locator(".d-cost-line")).toHaveCount(0);
    await expect(page.getByTestId("recommended-venue")).toHaveText("Pacifica");
  } finally {
    clearInterval(timer);
  }
});

test("stale venue is excluded immediately from averages while a healthy pair can continue", async ({
  page,
}) => {
  const data = await mockMarketData(page, { stream: true, phoenix: true });
  await page.goto("/demo?mode=auto&analysis=average");
  await expect(page.getByTestId("route-row-bulk")).toContainText(
    "Lowest 5s average",
    { timeout: 9000 },
  );
  data.sockets.find((s) => s.venue === "pacifica" && !s.closed)!.paused = true;
  await expect(page.getByTestId("route-row-pacifica")).toContainText(
    "Stale book",
    { timeout: 4000 },
  );
  await expect(
    page.getByTestId("route-row-pacifica").locator(".d-entry-cost"),
  ).toHaveCount(0);
  await expect(page.getByTestId("route-row-pacifica")).not.toHaveClass(
    /d-best-row/,
  );
  await expect(page.getByTestId("curve-pacifica")).toHaveCount(0);
  await expect(page.getByTestId("recommended-venue")).toHaveText("BULK");
  await expect(page.getByTestId("route-row-bulk")).toContainText(
    "Lowest 5s average",
  );
});

test("analysis selector fits mobile with adequate targets; leaving Pro disconnects its feeds", async ({
  page,
}) => {
  const data = await mockMarketData(page, { stream: true, phoenix: true });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/demo?mode=auto");
  await expect(page.getByTestId("curve-phoenix")).toHaveCount(1);
  for (const button of await page
    .getByRole("group", { name: "Comparison sampling" })
    .getByRole("button")
    .all()) {
    const bounds = await button.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(40);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/private/tmp/cinder-pro-sampling-mobile.png",
  });
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect.poll(() => data.sockets.filter((s) => !s.closed).length).toBe(0);
  await page.getByRole("button", { name: "Trade", exact: true }).click();
  await page.getByRole("button", { name: "5s average", exact: true }).click();
  await expect(page.getByTestId("analysis-status")).toHaveText(
    "Collecting 5s average",
  );
});

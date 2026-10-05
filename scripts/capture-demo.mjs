import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

// Capture the real chart-first route, never a separately drawn marketing mockup.
const origin = process.env.TEST_BASE_URL || "http://localhost:3000";
const agentsOnly = process.argv.includes("--agents");
const proOnly = process.argv.includes("--pro");
const featuresOnly = process.argv.includes("--features") || proOnly;
const allPreviews = process.argv.includes("--all");
const featureExports = featuresOnly || allPreviews;
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
  headless: true,
});
async function captureAgents(page) {
  // Capture the whole default view, including the directory and recent activity.
  // A tall viewport keeps it inside the terminal's native scroll container.
  await page.setViewportSize({ width: 1440, height: 1400 });
  await page.goto(`${origin}/demo?view=agents`, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("button", { name: "Agents", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.evaluate(() => document.fonts.ready);
  await page.locator(".d-agents-view").screenshot({
    path: "public/previews/cinder-agents.png",
    scale: "device",
  });
}
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(`${origin}/demo${agentsOnly ? "?view=agents" : ""}`, {
    waitUntil: "domcontentloaded",
  });
  // Use the actual first-visit action, rather than hiding onboarding with CSS.
  // The screenshot should show the terminal, not the invitation over it.
  await page.locator(".d-welcome-dialog").waitFor();
  await page
    .locator(".d-welcome-dialog")
    .getByRole("button", { name: "Skip", exact: true })
    .click();
  if (agentsOnly) {
    await mkdir("public/previews", { recursive: true });
    await captureAgents(page);
    console.log(
      JSON.stringify(
        {
          screenshot: "public/previews/cinder-agents.png",
          pixelScale: 2,
          errors,
        },
        null,
        2,
      ),
    );
    if (errors.length) throw new Error("Demo produced browser errors.");
  } else {
    await page
      .getByRole("heading", { name: "Cinder trading workspace", exact: true })
      .waitFor({ state: "attached" });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('[data-chart-status="ready"]').waitFor();
    // A websocket can supply a current candle before historical candles arrive.
    // Never replace the homepage preview with a near-empty, one-candle chart.
    await expect
      .poll(
        async () =>
          Number(
            await page.locator(".d-tv-chart").getAttribute("data-candle-count"),
          ),
        { timeout: 30_000 },
      )
      .toBeGreaterThan(40);
    await expect(page.getByTestId("book-status")).toHaveText("Live", {
      timeout: 30_000,
    });
    await expect(page.getByTestId("ticker-status")).toHaveAttribute(
      "data-health",
      "Live",
      { timeout: 30_000 },
    );
    await expect(
      page.getByRole("radio", { name: "Standard", exact: true }),
    ).toBeChecked();
    // Keep market entry visible without the default fixture's old limit price.
    await page.getByRole("radio", { name: "Market", exact: true }).check();
    await page
      .locator(".d-header .brand-mark")
      .evaluate((image) => image.decode());
    await page
      .locator(".d-header .brand-wordmark")
      .evaluate((image) => image.decode());
    await expect(page.locator(".d-welcome-dialog, .d-tour-dialog")).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Agents", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => document.activeElement?.blur());
    await page.mouse.move(0, 0);
    if (errors.length) throw new Error("Demo produced browser errors.");
    await mkdir("public/previews", { recursive: true });
    const workspace = page.getByTestId("demo-workspace");
    const box = await workspace.boundingBox();
    if (!featuresOnly) {
      await workspace.screenshot({
        path: "public/previews/cinder-trade.png",
        scale: "device", // 2x PNG keeps the actual UI crisp on retina displays.
      });
    }
    await mkdir("test-results/review", { recursive: true });
    await page.screenshot({
      path: "test-results/review/demo-desktop.png",
      fullPage: true,
    });
    for (const view of proOnly ? [] : ["account", "activity", "agents"]) {
      await page.setViewportSize({
        width: featureExports
          ? view === "activity"
            ? 1050
            : view === "agents"
              ? 1200
              : 1000
          : 1440,
        height: 1100,
      });
      await page.goto(`${origin}/demo?view=${view}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(
        page.getByRole("button", {
          name: `${view[0].toUpperCase()}${view.slice(1)}`,
          exact: true,
        }),
      ).toHaveAttribute("aria-current", "page");
      await page.evaluate(() => document.fonts.ready);
      if (featureExports) {
        const selector = {
          account: ".d-account-capital",
          activity: ".d-activity",
          agents: ".d-agents-view",
        }[view];
        if (view === "account") {
          await page.locator(selector).screenshot({
            path: `public/previews/cinder-${view}.png`,
            scale: "device",
          });
        } else if (view === "agents") {
          await captureAgents(page);
        } else {
          // Focus Activity on the first six events without a blank scroll tail.
          const panel = await page.locator(selector).boundingBox();
          const end = await page.locator(".d-events li").nth(5).boundingBox();
          if (!panel || !end) throw new Error(`Missing ${view} capture region`);
          await page.screenshot({
            path: `public/previews/cinder-${view}.png`,
            clip: {
              x: panel.x,
              y: panel.y,
              width: panel.width,
              height: end.y + end.height - panel.y,
            },
            scale: "device",
          });
        }
      }
      await page.screenshot({
        path: `test-results/review/demo-${view}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({
      width: featureExports ? 1200 : 1440,
      height: 960,
    });
    await page.goto(`${origin}/demo?mode=auto`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("radio", { name: "Pro", exact: true }),
    ).toBeChecked();
    await page
      .locator(".d-cost-line")
      .first()
      .waitFor({ state: "attached", timeout: 30_000 });
    if (featureExports) {
      await page.locator("#d-pro-market").selectOption("BTC");
      // Use a meaningful size and the same averaging control visitors can select.
      await page
        .getByRole("button", { name: "Set order notional to 100000 USDC" })
        .click();
      await expect(page.locator(".d-cost-notional")).toHaveText(
        "100,000.00 USDC",
      );
      await expect(
        page.getByRole("button", { name: "Set order notional to 100000 USDC" }),
      ).toHaveAttribute("aria-pressed", "true");
      await page
        .getByRole("button", { name: "5s average", exact: true })
        .click();
      await expect(page.getByTestId("analysis-status")).toContainText(
        /\d\/\d+ paired samples/i,
        { timeout: 30_000 },
      );
      // Prefer a complete comparison, but never synthesize a missing venue feed.
      try {
        await expect(page.locator(".d-cost-line")).toHaveCount(3, {
          timeout: 20_000,
        });
      } catch {
        console.log(
          "Capturing available venues; one public feed is unavailable.",
        );
      }
      await page.locator(".d-pro-workspace").screenshot({
        path: "public/previews/cinder-pro.png",
        scale: "device",
      });
    }
    await page.screenshot({
      path: "test-results/review/demo-pro.png",
      fullPage: true,
    });
    for (const width of proOnly ? [] : [375, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}/demo`, { waitUntil: "domcontentloaded" });
      await page.locator('[data-chart-status="ready"]').waitFor();
      await page.screenshot({
        path: `test-results/review/demo-${width}.png`,
        fullPage: true,
      });
    }
    console.log(
      JSON.stringify(
        {
          screenshot: proOnly
            ? "public/previews/cinder-pro.png"
            : featureExports
              ? "public/previews/cinder-{pro,account,activity,agents}.png"
              : "public/previews/cinder-trade.png",
          width: box?.width,
          height: box?.height,
          pixelScale: 2,
          errors,
        },
        null,
        2,
      ),
    );
    if (errors.length) throw new Error("Demo produced browser errors.");
  }
} finally {
  await browser.close();
}

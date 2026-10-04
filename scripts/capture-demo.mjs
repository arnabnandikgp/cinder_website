import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

// Capture the real chart-first route, never a separately drawn marketing mockup.
const origin = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
  headless: true,
});
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
  await page.goto(`${origin}/demo`, { waitUntil: "domcontentloaded" });
  // Use the actual first-visit action, rather than hiding onboarding with CSS.
  // The screenshot should show the terminal, not the invitation over it.
  await page.locator(".d-welcome-dialog").waitFor();
  await page
    .locator(".d-welcome-dialog")
    .getByRole("button", { name: "Skip", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Cinder trading workspace", exact: true })
    .waitFor({ state: "attached" });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('[data-chart-status="ready"]').waitFor();
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
  await workspace.screenshot({
    path: "public/previews/cinder-trade.png",
    scale: "device", // 2x PNG keeps the actual UI crisp on retina displays.
  });
  await mkdir("test-results/review", { recursive: true });
  await page.screenshot({
    path: "test-results/review/demo-desktop.png",
    fullPage: true,
  });
  for (const view of ["account", "activity", "agents"]) {
    await page.goto(`${origin}/demo?view=${view}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("button", {
        name: `${view[0].toUpperCase()}${view.slice(1)}`,
        exact: true,
      }),
    ).toHaveAttribute("aria-current", "page");
    await page.screenshot({
      path: `test-results/review/demo-${view}.png`,
      fullPage: true,
    });
  }
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
  await page.screenshot({
    path: "test-results/review/demo-pro.png",
    fullPage: true,
  });
  for (const width of [375, 768]) {
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
        screenshot: "public/previews/cinder-trade.png",
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
} finally {
  await browser.close();
}

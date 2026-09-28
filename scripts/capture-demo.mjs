import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

// Capture the real chart-first route, never a separately drawn marketing mockup.
const origin = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(`${origin}/demo`, { waitUntil: "networkidle" });
  await page
    .getByRole("heading", { name: "Cinder trading workspace", exact: true })
    .waitFor({ state: "attached" });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('[data-chart-status="ready"]').waitFor();
  await page
    .locator(".d-header .brand-mark")
    .evaluate((image) => image.decode());
  await page
    .locator(".d-header .brand-wordmark")
    .evaluate((image) => image.decode());
  await mkdir("public/previews", { recursive: true });
  const workspace = page.getByTestId("demo-workspace");
  const box = await workspace.boundingBox();
  await workspace.screenshot({
    path: "public/previews/cinder-trade.png",
    scale: "css",
  });
  await mkdir("test-results/review", { recursive: true });
  await page.screenshot({
    path: "test-results/review/demo-desktop.png",
    fullPage: true,
  });
  for (const view of ["account", "activity"]) {
    await page.goto(`${origin}/demo?view=${view}`, {
      waitUntil: "networkidle",
    });
    await page.screenshot({
      path: `test-results/review/demo-${view}.png`,
      fullPage: true,
    });
  }
  for (const width of [375, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}/demo`, { waitUntil: "networkidle" });
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

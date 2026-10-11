import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [375, 768, 1280]) {
    test(`cobalt Beams hero is readable at ${width}px in ${colorScheme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme, reducedMotion: "no-preference" });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/");
      const beams = page.locator(".hero-beams");
      await expect(beams).toHaveAttribute("aria-hidden", "true");
      await expect(beams).toHaveAttribute("data-renderer", "ready");
      await expect(beams).toHaveAttribute("data-theme", colorScheme);
      await expect(beams).toHaveAttribute("data-color", /#0051fe/i);
      await expect(beams.locator("canvas")).toHaveCount(1);
      await expect(beams.locator(".beams-container")).toHaveCSS(
        "opacity",
        colorScheme === "light" ? "0.72" : "0.7",
      );
      await expect(beams.locator(".hero-beams-fallback")).toHaveCSS(
        "opacity",
        "0",
      );
      await expect(page.locator(".hero-relief")).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const audit = await new AxeBuilder({ page })
        .include(".landing-hero")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(audit.violations).toEqual([]);
      expect(errors).toEqual([]);
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur(),
      );
      await page.locator(".landing-hero").screenshot({
        path: `test-results/review/hero-beams-${colorScheme}-${width}.png`,
      });
    });
  }
}

test("Beams follows theme changes and reduced motion without retaining a GPU loop", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  const beams = page.locator(".hero-beams");
  await expect(beams).toHaveAttribute("data-renderer", "static");
  await expect(beams.locator("canvas")).toHaveCount(0);
  await expect(beams.locator(".hero-beams-fallback")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(beams).toHaveAttribute("data-renderer", "ready");
  await page.getByRole("button", { name: "Dark theme", exact: true }).click();
  await expect(beams).toHaveAttribute("data-theme", "dark");
  await expect(beams.locator("canvas")).toHaveCount(1);
  await page.getByRole("button", { name: "System theme", exact: true }).click();
  await expect(beams).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(beams).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(beams).toHaveAttribute("data-renderer", "static");
  await expect(beams.locator("canvas")).toHaveCount(0);
});

test("Beams pauses drawing offscreen and while the document is hidden", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const draw = WebGL2RenderingContext.prototype.drawArrays;
    const counters = window as typeof window & { heroDraws: number };
    counters.heroDraws = 0;
    WebGL2RenderingContext.prototype.drawArrays = function (...args) {
      counters.heroDraws++;
      return draw.apply(this, args);
    };
  });
  await page.goto("/");
  const count = () =>
    page.evaluate(
      () => (window as typeof window & { heroDraws: number }).heroDraws,
    );
  await expect(page.locator(".hero-beams")).toHaveAttribute(
    "data-renderer",
    "ready",
  );
  const first = await count();
  await expect.poll(count).toBeGreaterThan(first);
  await page.locator("#account").scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const stopped = await count();
  await page.waitForTimeout(250);
  expect(await count()).toBe(stopped);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect.poll(count).toBeGreaterThan(stopped);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(150);
  const hidden = await count();
  await page.waitForTimeout(250);
  expect(await count()).toBe(hidden);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(count).toBeGreaterThan(hidden);
});

test("graphics-unavailable visitors get static cobalt artwork and working CTAs", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args
    ) {
      if (args[0] === "webgl2") return null;
      return getContext.apply(this, args);
    } as typeof getContext;
  });
  await page.goto("/");
  await expect(page.locator(".hero-beams")).toHaveAttribute(
    "data-renderer",
    "unavailable",
  );
  await expect(page.locator(".hero-beams-fallback")).toHaveCSS(
    "opacity",
    "0.72",
  );
  await expect(page.locator(".landing-hero .beams-container")).toHaveCSS(
    "opacity",
    "0",
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page
      .locator(".landing-hero")
      .getByRole("link", { name: "Explore the demo", exact: true }),
  ).toHaveAttribute("href", "/demo");
});

test("losing the graphics context restores the fallback", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".hero-beams")).toHaveAttribute(
    "data-renderer",
    "ready",
  );
  await page
    .locator(".hero-beams canvas")
    .evaluate((canvas: HTMLCanvasElement) => {
      canvas
        .getContext("webgl2")!
        .getExtension("WEBGL_lose_context")!
        .loseContext();
    });
  await expect(page.locator(".hero-beams")).toHaveAttribute(
    "data-renderer",
    "unavailable",
  );
  await expect(page.locator(".hero-beams-fallback")).toBeVisible();
});

test("the hero remains complete without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator(".hero-beams")).toHaveAttribute(
    "data-renderer",
    "static",
  );
  await expect(page.locator(".hero-beams canvas")).toHaveCount(0);
  await expect(page.locator(".hero-beams-fallback")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A Solana-native prime broker for perps.",
  );
  await context.close();
});

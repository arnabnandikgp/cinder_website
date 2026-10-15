import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("header and hero fill the first screen without showing the next section", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1280, height: 900 },
    { width: 1440, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const header = (await page.getByRole("banner").boundingBox())!;
    const hero = (await page.locator(".landing-hero").boundingBox())!;
    const nextSection = (await page.locator("#brokerage").boundingBox())!;
    expect(Math.abs(hero.y - header.y - header.height)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(hero.y + hero.height - viewport.height),
    ).toBeLessThanOrEqual(1);
    expect(nextSection.y).toBeGreaterThanOrEqual(viewport.height - 1);
  }
});

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [375, 768, 1280]) {
    test(`architectural hero is readable at ${width}px in ${colorScheme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/");
      const artwork = page.locator(".hero-architecture");
      await expect(artwork).toHaveAttribute("aria-hidden", "true");
      await expect(artwork).toHaveAttribute("data-active", "false");
      await expect(artwork.locator("svg")).toBeVisible();
      await expect(page.locator(".landing-hero canvas")).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
        "font-weight",
        "600",
      );
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
      await page.locator(".landing-hero").screenshot({
        path: `test-results/review/hero-architecture-${colorScheme}-${width}.png`,
      });
    });
  }
}

test("ambient artwork pauses offscreen, in a hidden document and for reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const artwork = page.locator(".hero-architecture");
  await expect(artwork).toHaveAttribute("data-active", "true");
  await page.locator("#account").scrollIntoViewIfNeeded();
  await expect(artwork).toHaveAttribute("data-active", "false");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(artwork).toHaveAttribute("data-active", "true");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(artwork).toHaveAttribute("data-active", "false");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(artwork).toHaveAttribute("data-active", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(artwork).toHaveAttribute("data-active", "false");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(artwork).toHaveAttribute("data-active", "true");
});

test("artwork follows explicit and system theme changes without a graphics renderer", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const plane = page.locator("#cinder-plane-front stop").first();
  const light = await plane.evaluate(
    (node) => getComputedStyle(node).stopColor,
  );
  await page.getByRole("button", { name: "Dark theme", exact: true }).click();
  const dark = await plane.evaluate((node) => getComputedStyle(node).stopColor);
  expect(dark).not.toBe(light);
  await page.getByRole("button", { name: "System theme", exact: true }).click();
  await expect(plane).toHaveCSS("stop-color", light);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(plane).toHaveCSS("stop-color", dark);
  await expect(page.locator(".landing-hero canvas")).toHaveCount(0);
});

test("the complete hero is available without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator(".hero-architecture svg")).toBeVisible();
  await expect(page.locator(".hero-architecture")).toHaveAttribute(
    "data-active",
    "false",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your prime broker for perps.",
  );
  await expect(
    page
      .locator(".landing-hero")
      .getByRole("link", { name: "Explore the demo", exact: true }),
  ).toHaveAttribute("href", "/demo");
  await context.close();
});

test("account scenes remain stable, legible and accessible in both themes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    const stage = page.locator(".account-stage");
    const heights: number[] = [];
    for (const scene of [
      "Know where you stand.",
      "See every position.",
      "Connect every move.",
    ]) {
      await page
        .getByRole("button", { name: new RegExp(scene.replaceAll(".", "\\.")) })
        .click();
      heights.push((await stage.boundingBox())!.height);
      for (const theme of ["light", "dark"] as const) {
        await page
          .getByRole("button", {
            name: `${theme === "light" ? "Light" : "Dark"} theme`,
            exact: true,
          })
          .click();
        const audit = await new AxeBuilder({ page })
          .include("#account")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(audit.violations).toEqual([]);
        await stage.screenshot({
          path: `test-results/review/account-${scene.split(" ")[0].toLowerCase()}-${theme}-${width}.png`,
        });
      }
    }
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

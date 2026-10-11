import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [375, 768, 1280]) {
    test(`account accordion is readable at ${width}px in ${colorScheme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto("/");
      const story = page.locator(".account-story");
      await story.scrollIntoViewIfNeeded();
      await page.evaluate(() => document.fonts.ready);
      const buttons = story.locator(".account-step-list > button");
      for (let index = 0; index < 3; index++) {
        await buttons.nth(index).click();
        await expect(buttons.nth(index)).toHaveAttribute(
          "aria-expanded",
          "true",
        );
        await expect(story.locator('[aria-expanded="true"]')).toHaveCount(1);
        const detail = buttons.nth(index).locator(".account-step-detail");
        expect((await detail.boundingBox())!.height).toBeGreaterThan(24);
        for (const collapsed of await story
          .locator('[aria-expanded="false"] .account-step-detail')
          .all()) {
          expect((await collapsed.boundingBox())!.height).toBe(0);
        }
        expect(
          (await buttons.nth(index).boundingBox())!.height,
        ).toBeGreaterThanOrEqual(44);
        await page.locator("#account").screenshot({
          path: `test-results/review/account-${colorScheme}-${width}-${index}.png`,
        });
      }
      const audit = await new AxeBuilder({ page })
        .include("#account")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(audit.violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  }
}

test("vertical rails track step time, preserve offscreen progress and stop on selection", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  const story = page.locator(".account-story");
  await story.scrollIntoViewIfNeeded();
  await expect(story).toHaveAttribute("data-advancing", "true");
  const active = story.locator('[aria-expanded="true"]');
  const rail = active.locator(".account-step-rail > span");
  const scale = () =>
    rail.evaluate(
      (node) => new DOMMatrix(getComputedStyle(node).transform).m22,
    );
  await page.clock.runFor(3000);
  const before = await scale();
  expect(before).toBeGreaterThan(0.4);
  expect(before).toBeLessThan(0.5);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(story).toHaveAttribute("data-advancing", "false");
  const stopped = await scale();
  await page.clock.runFor(5000);
  expect(await scale()).toBe(stopped);
  await story.scrollIntoViewIfNeeded();
  await expect(story).toHaveAttribute("data-advancing", "true");
  await page.clock.runFor(4200);
  await expect(active).toContainText("See every position.");
  expect(await scale()).toBeLessThan(0.1);
  await story.getByRole("button", { name: /Connect every move/ }).focus();
  await page.keyboard.press("Enter");
  await expect(active).toContainText("Connect every move.");
  await expect(story).toHaveAttribute("data-advancing", "false");
  expect(await scale()).toBe(1);
  await page.clock.runFor(15000);
  await expect(active).toContainText("Connect every move.");
});

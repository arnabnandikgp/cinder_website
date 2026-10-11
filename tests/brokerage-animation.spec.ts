import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [375, 768, 1280]) {
    test(`brokerage final state is readable at ${width}px in ${colorScheme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto("/");
      const diagram = page.locator(".brokerage-map");
      await diagram.scrollIntoViewIfNeeded();
      await page.evaluate(() => document.fonts.ready);
      await expect(diagram).toHaveAttribute("data-phase", "4");
      await expect(diagram).toHaveAttribute("data-playing", "false");
      const hub = diagram.locator(".brokerage-hub");
      const boundary = await hub.boundingBox();
      for (const text of await hub.locator("h3, li").all()) {
        const box = await text.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(boundary!.x);
        expect(box!.x + box!.width).toBeLessThanOrEqual(
          boundary!.x + boundary!.width + 1,
        );
        expect(box!.y).toBeGreaterThanOrEqual(boundary!.y);
        expect(box!.y + box!.height).toBeLessThanOrEqual(
          boundary!.y + boundary!.height + 1,
        );
        await expect(text).toHaveCSS("opacity", "1");
      }
      for (const source of await diagram
        .locator(".brokerage-participant")
        .all()) {
        const a = await source.boundingBox();
        expect(
          a!.x + a!.width <= boundary!.x || a!.y + a!.height <= boundary!.y,
        ).toBe(true);
      }
      const audit = await new AxeBuilder({ page })
        .include(".brokerage-map")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        audit.violations.map(({ id, nodes }) => ({
          id,
          targets: nodes.map((node) => node.target),
        })),
      ).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      // Axe can focus the skip link while auditing; don't include its temporary
      // focused state in the visual review image.
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur(),
      );
      await page.locator("#brokerage").screenshot({
        path: `test-results/review/brokerage-${colorScheme}-${width}.png`,
      });
    });
  }
}

test("brokerage stages retain fixed endpoints and reduced motion interrupts immediately", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.clock.install();
  await page.goto("/");
  const diagram = page.locator(".brokerage-map");
  await diagram.scrollIntoViewIfNeeded();
  await expect(diagram).toHaveAttribute("data-phase", "0");
  const endpoints = diagram.locator(".brokerage-participant, .brokerage-venue");
  const positions = await endpoints.evaluateAll((nodes) =>
    nodes.map((node) => ({
      x: node.getBoundingClientRect().x,
      y: node.getBoundingClientRect().y,
    })),
  );
  await diagram.screenshot({
    path: "test-results/review/brokerage-stage-0.png",
  });
  for (const [duration, phase] of [
    [2100, "1"],
    [1900, "2"],
    [1700, "3"],
  ] as const) {
    await page.clock.runFor(duration);
    await expect(diagram).toHaveAttribute("data-phase", phase);
    expect(
      await endpoints.evaluateAll((nodes) =>
        nodes.map((node) => ({
          x: node.getBoundingClientRect().x,
          y: node.getBoundingClientRect().y,
        })),
      ),
    ).toEqual(positions);
    await diagram.screenshot({
      path: `test-results/review/brokerage-stage-${phase}.png`,
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(diagram).toHaveAttribute("data-phase", "4");
  await expect(diagram).toHaveAttribute("data-playing", "false");
  await expect(
    diagram.getByRole("button", { includeHidden: true }),
  ).toBeHidden();
  await expect(diagram.locator(".brokerage-layer")).toHaveCSS("opacity", "1");
  await page.clock.runFor(2000);
  await expect(diagram).toHaveAttribute("data-phase", "4");
});

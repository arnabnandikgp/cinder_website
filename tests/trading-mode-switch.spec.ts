import { mockWallet, connectWallet } from "./helpers/wallet";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockMarketData } from "./helpers/market-data";

test.beforeEach(async ({ page }) => {
  await mockWallet(page);
});

test.beforeEach(async ({ page }) => {
  await mockMarketData(page, { stream: true, phoenix: true });
});

test("mode choices explain the difference and remain keyboard-operable native radios", async ({
  page,
}) => {
  await page.goto("/demo");
  await connectWallet(page);
  const group = page.getByRole("group", { name: "Trading mode", exact: true });
  const standard = group.getByRole("radio", { name: "Standard", exact: true });
  const pro = group.getByRole("radio", { name: "Pro", exact: true });
  await expect(standard).toBeChecked();
  await expect(pro).not.toBeChecked();
  await expect(standard).toHaveAccessibleDescription("Choose venue");
  await expect(pro).toHaveAccessibleDescription("Compare venues");
  await expect(standard.locator("..").locator(".d-mode-selected")).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(pro.locator("..").locator(".d-mode-selected")).toHaveCSS(
    "opacity",
    "0",
  );
  await page.getByLabel("Order size", { exact: true }).fill("765");
  await page.keyboard.press("Tab");
  await standard.focus();
  await expect(standard.locator("..")).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("ArrowRight");
  await expect(pro).toBeChecked();
  await expect(pro).toBeFocused();
  await expect(page).toHaveURL(/mode=auto/);
  await expect(page.getByLabel("Pro execution workspace")).toBeVisible();
  await expect(pro.locator("..").locator(".d-mode-selected")).toHaveCSS(
    "opacity",
    "1",
  );
  await page.keyboard.press("ArrowLeft");
  await expect(standard).toBeChecked();
  await expect(page.getByLabel("Order size", { exact: true })).toHaveValue(
    "765",
  );
  await pro.focus();
  await page.keyboard.press("Space");
  await expect(pro).toBeChecked();
  await expect(standard).not.toBeChecked();
});

for (const [width, height] of [
  [375, 900],
  [768, 900],
  [1280, 720],
  [1440, 1000],
]) {
  test(`mode buttons are distinct, readable and touch-sized at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/demo");
    const standard = page.getByRole("radio", { name: "Standard", exact: true });
    const pro = page.getByRole("radio", { name: "Pro", exact: true });
    const standardTile = standard.locator("..");
    const proTile = pro.locator("..");
    // Branding must not make inactive Pro look selected. Both modes use the
    // same cobalt + check treatment only when active, including on hover.
    await expect(standardTile).toHaveCSS("background-color", "rgb(0, 81, 254)");
    await expect(proTile).toHaveCSS("background-color", "rgb(18, 18, 18)");
    await expect(proTile).toHaveCSS("background-image", "none");
    for (const choice of [standard, pro]) {
      const target = (await choice.boundingBox())!;
      const tile = (await choice.locator("..").boundingBox())!;
      const caption = (await choice
        .locator("..")
        .locator(".d-mode-copy")
        .boundingBox())!;
      expect(target.width).toBeGreaterThanOrEqual(40);
      expect(target.height).toBeGreaterThanOrEqual(40);
      expect(caption.x + caption.width).toBeLessThanOrEqual(
        tile.x + tile.width,
      );
      expect(caption.y + caption.height).toBeLessThanOrEqual(
        tile.y + tile.height,
      );
    }
    for (const choice of [pro, standard]) {
      await choice.check();
      await expect(choice).toBeChecked();
      const active = choice.locator("..");
      const inactive = (choice === pro ? standard : pro).locator("..");
      await expect(active).toHaveCSS("background-color", "rgb(0, 81, 254)");
      await expect(active).toHaveCSS("border-top-color", "rgb(145, 179, 255)");
      await expect(active.locator(".d-mode-selected")).toHaveCSS(
        "opacity",
        "1",
      );
      await expect(inactive.locator(".d-mode-selected")).toHaveCSS(
        "opacity",
        "0",
      );
      await inactive.hover();
      await expect(inactive).toHaveCSS("background-color", "rgb(31, 31, 31)");
      await expect(inactive).toHaveCSS("border-top-color", "rgb(85, 85, 91)");
      await expect(inactive).toHaveCSS("background-image", "none");
      await active.hover();
      await expect(active).toHaveCSS("background-color", "rgb(0, 81, 254)");
      await expect(active).toHaveCSS("border-top-color", "rgb(145, 179, 255)");
      const audit = await new AxeBuilder({ page })
        .include(".d-mode-switch")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        audit.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    if (width === 375 || width === 1280) {
      for (const [mode, choice] of [
        ["standard", standard],
        ["pro", pro],
      ] as const) {
        await choice.check();
        await page.mouse.move(0, 0);
        await page.locator(".d-mode-switch").screenshot({
          path: `test-results/mode-switch-${mode}-${width}.png`,
        });
      }
    }
  });
}

test("mode emphasis stays static and respects reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo");
  for (const mode of ["Standard", "Pro"]) {
    const input = page.getByRole("radio", { name: mode, exact: true });
    await input.check();
    await expect(input.locator("..")).toHaveCSS("animation-name", "none");
    await expect(input.locator("..")).toHaveCSS("transition-duration", "0s");
  }
});

import { expect, test } from "@playwright/test";

test("wordmarks are true vector outlines with transparent high-resolution PNG exports", async ({
  request,
}) => {
  for (const variant of ["dark", "light"]) {
    const vector = await request.get(`/brand/wordmark-${variant}.svg`);
    expect(vector.ok()).toBe(true);
    expect(vector.headers()["content-type"]).toContain("image/svg+xml");
    const svg = await vector.text();
    expect(svg).toContain('viewBox="0 0 810 214"');
    expect(svg).not.toMatch(/<image|<text|<script|<foreignObject|base64/);
    expect(svg.match(/<path\s/g)).toHaveLength(6);
    expect(svg.match(/<ellipse\s/g)).toHaveLength(1);
    for (const letter of ["C", "i dot", "i", "n", "d", "e", "r"]) {
      expect(svg).toContain(`aria-label="${letter}"`);
    }
    const png = await request.get(`/brand/wordmark-${variant}.png`);
    expect(png.ok()).toBe(true);
    const bytes = await png.body();
    expect(bytes.readUInt32BE(16)).toBe(2430);
    expect(bytes.readUInt32BE(20)).toBe(642);
    expect(bytes[25]).toBe(6); // PNG color type 6: RGBA, not an opaque backdrop.
  }
});

for (const width of [375, 768, 1280]) {
  for (const route of ["/", "/demo"]) {
    test(`clean wordmark renders without raster conversion at ${width}px on ${route}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      const header = route === "/" ? ".header-inner" : ".d-header";
      const wordmark = page.locator(`${header} .brand-wordmark`);
      await expect(wordmark).toHaveAttribute("src", "/brand/wordmark-dark.svg");
      await expect(wordmark).toHaveAttribute("alt", "Cinder");
      await wordmark.evaluate((element) =>
        (element as HTMLImageElement).decode(),
      );
      expect(
        await wordmark.evaluate((element) => {
          const image = element as HTMLImageElement;
          return [image.naturalWidth, image.naturalHeight];
        }),
      ).toEqual([810, 214]);
      const box = await wordmark.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height / box!.width).toBeCloseTo(214 / 810, 2);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      await expect(page.locator(`${header} .brand`)).toHaveAccessibleName(
        "Cinder home",
      );
    });
  }
}

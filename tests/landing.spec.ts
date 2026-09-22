import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [375, 768, 1280]) {
  test(`page is readable and accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "One private accountfor Solana perps.",
    );
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole("link", { name: /early access/i })).toHaveCount(
      0,
    );
    const dimensions = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
    const brokenImages = await page.locator("img").evaluateAll((images) =>
      images
        .map((image) => image as HTMLImageElement)
        .filter((image) => image.complete && image.naturalWidth === 0)
        .map((image) => image.src),
    );
    expect(brokenImages).toEqual([]);
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        description: v.description,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `test-results/viewport-${width}.png` });
    await page.screenshot({
      path: `test-results/landing-${width}.png`,
      fullPage: true,
    });
  });
}

test("FAQ, navigation and information boundaries work with the keyboard", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByText("Is Cinder a new perp exchange?", { exact: true })
    .click();
  await expect(
    page.getByText(
      "No. Cinder routes execution to existing venues and their liquidity.",
      { exact: true },
    ),
  ).toBeVisible();
  const question = page
    .locator("summary")
    .filter({ hasText: "What remains private?" });
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(/Balances, positions, open orders, risk, and user-linked/),
  ).toBeVisible();
  await expect(
    page.getByText(
      "No. Cinder routes execution to existing venues and their liquidity.",
      { exact: true },
    ),
  ).not.toBeVisible();
  const selectedVenue = page.getByRole("button", {
    name: "Selected venue",
    exact: true,
  });
  await selectedVenue.click();
  await expect(selectedVenue).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByText("Only what execution requires.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".visibility-grid .visible-cell")).toHaveCount(1);
  await page.getByRole("button", { name: "Operators", exact: true }).focus();
  await expect(page.locator(".visibility-grid .visible-cell")).toHaveCount(0);
  const footer = page.getByRole("navigation", { name: "Footer navigation" });
  await expect(
    footer.getByRole("link", { name: "X", exact: true }),
  ).toHaveAttribute("href", "https://x.com/CinderExchange");
  await expect(
    footer.getByRole("link", { name: "Contact", exact: true }),
  ).toHaveAttribute("href", "https://x.com/CinderExchange");
  await expect(footer.getByRole("link", { name: "GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/arnabnandikgp/cinder",
  );
});

test("mobile navigation closes on selection and Escape", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Open navigation" });
  await toggle.click();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).not.toBeVisible();
  await toggle.click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "The vision" })
    .click();
  await expect(page).toHaveURL(/#vision$/);
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).not.toBeVisible();
});

test("hero flow pauses offscreen, on demand, and with reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const flow = page.locator(".hero-network");
  await expect(flow).toHaveClass(/is-active/);
  await page.getByRole("button", { name: "Pause flow" }).click();
  await expect(flow).not.toHaveClass(/is-active/);
  await page.getByRole("button", { name: "Play flow" }).click();
  await expect(flow).toHaveClass(/is-active/);
  await page
    .getByRole("heading", { name: "Trade through Cinder." })
    .scrollIntoViewIfNeeded();
  await expect(flow).not.toHaveClass(/is-active/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(flow).not.toHaveClass(/is-active/);
  const animation = await page
    .locator(".hero-connectors .flow-in")
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(animation).toBe("none");
});

test("branded social preview is available", async ({ request }) => {
  const response = await request.get("/opengraph-image");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/png");
  const body = await response.body();
  expect(body.readUInt32BE(16)).toBe(1200);
  expect(body.readUInt32BE(20)).toBe(630);
});

test("hero connections stay attached to each node when the layout resizes", async ({
  page,
}) => {
  await page.goto("/");
  for (const width of [1280, 1024, 375, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const stage = document.querySelector<HTMLElement>(".network-stage")!;
          const vertical = getComputedStyle(stage).flexDirection === "column";
          const source = stage
            .querySelector(vertical ? ".trader-node" : ".node-icon")!
            .getBoundingClientRect();
          const account = stage
            .querySelector(".account-node")!
            .getBoundingClientRect();
          const venues = Array.from(
            stage.querySelectorAll(".venue-node"),
            (node) => node.getBoundingClientRect(),
          );
          const incoming = stage.querySelector<SVGPathElement>(
            ".strategy-connection",
          );
          const routes = Array.from(
            stage.querySelectorAll<SVGPathElement>(".venue-connection"),
          );
          if (!incoming || routes.length !== 3) return Infinity;
          const endpoint = (path: SVGPathElement, end: boolean) => {
            const point = path.getPointAtLength(
              end ? path.getTotalLength() : 0,
            );
            return new DOMPoint(point.x, point.y).matrixTransform(
              path.getScreenCTM()!,
            );
          };
          const delta = (actual: DOMPoint, x: number, y: number) =>
            Math.max(Math.abs(actual.x - x), Math.abs(actual.y - y));
          const errors = [
            delta(
              endpoint(incoming, false),
              vertical ? source.left + source.width / 2 : source.right,
              vertical ? source.bottom : source.top + source.height / 2,
            ),
            delta(
              endpoint(incoming, true),
              vertical ? account.left + account.width / 2 : account.left,
              vertical ? account.top : account.top + account.height / 2,
            ),
          ];
          const starts = routes.map((route) => endpoint(route, false));
          routes.forEach((route, i) => {
            const start = starts[i];
            const venue = venues[i];
            // Each venue route must originate on Cinder itself, at a separate port.
            errors.push(
              vertical
                ? Math.abs(start.y - account.bottom)
                : Math.abs(start.x - account.right),
            );
            const insideEdge = vertical
              ? start.x > account.left && start.x < account.right
              : start.y > account.top && start.y < account.bottom;
            if (!insideEdge) errors.push(Infinity);
            errors.push(
              delta(
                endpoint(route, true),
                vertical ? venue.left + venue.width / 2 : venue.left,
                vertical ? venue.top : venue.top + venue.height / 2,
              ),
            );
            if (
              i > 0 &&
              Math.hypot(start.x - starts[i - 1].x, start.y - starts[i - 1].y) <
                10
            )
              errors.push(Infinity);
          });
          return Math.max(...errors);
        }),
      )
      .toBeLessThan(1);
    await page
      .locator(".hero")
      .screenshot({ path: `test-results/hero-connections-${width}.png` });
  }
});

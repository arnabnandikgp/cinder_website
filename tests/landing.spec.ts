import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [375, 768, 1280]) {
  test(`page is readable and accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "One accountfor Solana perps.",
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
      "No. Cinder is designed to route orders to connected perp venues. Each venue continues to operate its own market and liquidity.",
      { exact: true },
    ),
  ).toBeVisible();
  const question = page
    .locator("summary")
    .filter({ hasText: "What remains private?" });
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(/Cinder is designed to handle individual account state/),
  ).toBeVisible();
  await expect(
    page.getByText(
      "No. Cinder is designed to route orders to connected perp venues. Each venue continues to operate its own market and liquidity.",
      { exact: true },
    ),
  ).not.toBeVisible();
  const selectedVenue = page.getByRole("button", {
    name: "Selected venue",
    exact: true,
  });
  await selectedVenue.focus();
  await expect(selectedVenue).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByText("The information needed to execute.", { exact: true }),
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

test("navigation stays legible and available around its responsive breakpoint", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/");
  const desktopNav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(desktopNav).toBeVisible();
  await expect(page.locator(".header-inner")).toHaveCSS(
    "border-radius",
    "999px",
  );
  await expect(desktopNav.getByRole("link", { name: "The account" })).toHaveCSS(
    "font-size",
    "14px",
  );

  await page.setViewportSize({ width: 921, height: 900 });
  await expect(desktopNav).toBeVisible();
  const spacing = await page.evaluate(() => {
    const brand = document.querySelector(".header-inner .brand")!;
    const nav = document.querySelector(".desktop-nav")!;
    const contact = document.querySelector(".header-contact")!;
    return {
      beforeNav:
        nav.getBoundingClientRect().left - brand.getBoundingClientRect().right,
      afterNav:
        contact.getBoundingClientRect().left -
        nav.getBoundingClientRect().right,
    };
  });
  expect(spacing.beforeNav).toBeGreaterThan(0);
  expect(spacing.afterNav).toBeGreaterThan(0);

  await page.setViewportSize({ width: 900, height: 900 });
  await expect(desktopNav).toBeHidden();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();
});

test("navigation indicator follows links and scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const advantage = nav.getByRole("link", { name: "The account" });
  const privacy = nav.getByRole("link", { name: "Privacy" });
  const vision = nav.getByRole("link", { name: "The vision" });
  const faq = nav.getByRole("link", { name: "FAQs" });
  const dot = nav.locator(".nav-indicator");

  await expect(nav.locator("[aria-current]")).toHaveCount(0);
  await expect(dot).toHaveCSS("opacity", "0");
  await page.evaluate(() =>
    document.getElementById("market")?.scrollIntoView({ behavior: "instant" }),
  );
  await expect(nav.locator("[aria-current]")).toHaveCount(0);
  await page.evaluate(() =>
    document
      .getElementById("advantage")
      ?.scrollIntoView({ behavior: "instant" }),
  );
  await expect(advantage).toHaveAttribute("aria-current", "location");
  await expect(dot).toHaveCSS("opacity", "1");
  const initialX = await dot.evaluate(
    (element) => element.getBoundingClientRect().x,
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(nav.locator("[aria-current]")).toHaveCount(0);
  await expect(dot).toHaveCSS("opacity", "0");
  await page.getByRole("link", { name: "Why privacy matters" }).click();
  await expect(page).toHaveURL(/#privacy$/);
  await expect(privacy).toHaveAttribute("aria-current", "location");
  await expect
    .poll(async () =>
      dot.evaluate((element) => element.getBoundingClientRect().x),
    )
    .toBeGreaterThan(initialX + 40);

  await page.evaluate(() =>
    document.getElementById("vision")?.scrollIntoView({ behavior: "instant" }),
  );
  await expect(vision).toHaveAttribute("aria-current", "location");
  await page.evaluate(() =>
    document.getElementById("faq")?.scrollIntoView({ behavior: "instant" }),
  );
  await expect(faq).toHaveAttribute("aria-current", "location");
});

test("hero leads with the prime broker proposition", async ({ page }) => {
  await page.goto("/");
  const intro = page.locator(".hero-intro");
  await expect(intro).toContainText(
    "Access connected perp venues through a single prime broker account.",
  );
  await expect(intro).toContainText(
    "benefit from aggregated trading activity.",
  );
  await expect(intro).not.toContainText(/private|confidential|TEE/i);
  await expect(page.locator(".hero-promise")).toHaveCount(0);
});

test("hero flow loops without controls and respects reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /pause flow|play flow/i }),
  ).toHaveCount(0);
  const flow = page.locator(".hero-connectors .flow-in");
  await expect(flow).toHaveCSS("animation-name", "route-flow");
  await expect(flow).toHaveCSS("animation-play-state", "running");
  await page
    .getByRole("heading", { name: /One account.*More connected trading/ })
    .scrollIntoViewIfNeeded();
  await expect(flow).toHaveCSS("animation-play-state", "running");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(flow).toHaveCSS("animation-name", "none");
});

test("branded social preview is available", async ({ request }) => {
  const response = await request.get("/opengraph-image");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/png");
  const body = await response.body();
  expect(body.readUInt32BE(16)).toBe(1200);
  expect(body.readUInt32BE(20)).toBe(630);
});

test("page copy and metadata use no em dashes", async ({ page }) => {
  await page.goto("/");
  const title = "Cinder | One account for Solana perps";
  await expect(page).toHaveTitle(title);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    title,
  );
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
    "content",
    title,
  );
  expect(await page.locator("body").innerText()).not.toContain("—");
});

test("the story introduces privacy after the account and routing proposition", async ({
  page,
}) => {
  await page.goto("/");
  const ids = await page
    .locator("main > section[id]")
    .evaluateAll((sections) => sections.map((section) => section.id));
  expect(ids).toEqual(["market", "advantage", "privacy", "vision", "faq"]);
  await expect(
    page.getByRole("heading", { name: "One connection. More markets." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pool volume. Qualify together." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Every position. One account view." }),
  ).toBeVisible();
  await expect(page.locator("#privacy")).toContainText(
    "trusted execution environment (TEE)",
  );
  await expect(page.locator("#vision")).toContainText(
    "not capabilities promised at launch",
  );
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

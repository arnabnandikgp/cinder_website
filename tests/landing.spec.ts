import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("requested supporting copy and empty wrappers are removed", async ({
  page,
}) => {
  await page.goto("/");
  for (const text of [
    "Explore with sample data. No wallet required.",
    "THE CINDER ACCOUNT",
    "Interactive prototype · Sample data · No live trading",
    "The venues provide the liquidity. Cinder brings your trading together.",
    "Your positions and trading results remain individually accounted for.",
    "Deposits and payouts remain public. A separate recovery process",
    "Product direction, not a list of live capabilities.",
  ]) {
    await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  }
  await expect(
    page.locator(
      ".product-preview figcaption, .account-model-note, .privacy-support, .roadmap-note",
    ),
  ).toHaveCount(0);
});

for (const width of [375, 768, 1280]) {
  test(`homepage is readable and accessible at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "One accountfor Solana perps.",
    );
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .locator(".product-preview img")
      .evaluate((image: HTMLImageElement) => image.decode());
    await page.locator(".article-feature img").scrollIntoViewIfNeeded();
    await page
      .locator(".article-feature img")
      .evaluate((image: HTMLImageElement) => image.decode());
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    expect(errors).toEqual([]);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: `test-results/review/home-${width}.png`,
      fullPage: true,
    });
    await page.locator(".article-feature").screenshot({
      path: `test-results/review/article-${width}.png`,
    });
  });
}

test("homepage uses the chart-first screenshot and links to the real demo and article", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".product-preview img")).toHaveAttribute(
    "src",
    /cinder-trade/,
  );
  await expect(page.locator(".product-preview-link")).toHaveAttribute(
    "href",
    "/demo",
  );
  await expect(page.locator(".hero-intro")).toContainText("Choose your venue");
  await expect(page.locator(".hero-intro")).not.toContainText(
    /router|automatically/i,
  );
  await expect(page.locator(".article-feature")).toHaveAttribute(
    "href",
    "https://x.com/CinderExchange/status/2104439873029685347",
  );
  await expect(page.locator(".article-feature")).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
  await expect(page.locator(".article-feature")).toContainText("Read article");
  await expect(page.getByRole("link", { name: /early access/i })).toHaveCount(
    0,
  );
  await page
    .getByRole("link", { name: "Explore the chart-first Cinder demo" })
    .click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(
    page.getByRole("heading", { name: "Cinder trading workspace" }),
  ).toBeAttached();
});

test("story distinguishes the account from future routing and clearing", async ({
  page,
}) => {
  await page.goto("/");
  expect(
    await page
      .locator("main > section[id]")
      .evaluateAll((nodes) => nodes.map((node) => node.id)),
  ).toEqual(["advantage", "economics", "privacy", "vision", "article", "faq"]);
  await expect(page.locator("#economics")).toContainText(
    "Actual pricing depends on venue rules",
  );
  await expect(page.locator("#privacy")).toContainText(
    "trusted execution environment (TEE)",
  );
  await expect(page.locator("#vision")).toContainText("Optional routing");
  await expect(page.locator("#vision")).toContainText("THE LONGER-TERM VISION");
});

test("FAQ, privacy boundaries and footer work with keyboard", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("summary")
    .filter({ hasText: "Is Cinder a new perp exchange?" })
    .click();
  await expect(
    page.getByText(/No. Cinder is a broker, not another matching engine/),
  ).toBeVisible();
  const question = page
    .locator("summary")
    .filter({ hasText: "What remains private?" });
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(
      /Cinder is designed to handle individual orders and account records inside/,
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/No. Cinder is a broker, not another matching engine/),
  ).not.toBeVisible();
  await page
    .getByRole("button", { name: "Selected venue", exact: true })
    .focus();
  await expect(page.locator(".visibility-grid .visible-cell")).toHaveCount(1);
  await page.getByRole("button", { name: "Operators", exact: true }).focus();
  await expect(page.locator(".visibility-grid .visible-cell")).toHaveCount(0);
  const footer = page.getByRole("navigation", { name: "Footer navigation" });
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
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "The vision" })
    .click();
  await expect(page).toHaveURL(/#vision$/);
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeHidden();
});

test("navigation dot is absent at the hero and follows section visits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.locator("[aria-current]")).toHaveCount(0);
  await expect(nav.locator(".nav-indicator")).toHaveCSS("opacity", "0");
  for (const [id, name] of [
    ["advantage", "The account"],
    ["privacy", "Privacy"],
    ["vision", "The vision"],
    ["faq", "FAQs"],
  ]) {
    await page.evaluate(
      (id) =>
        document.getElementById(id)?.scrollIntoView({ behavior: "instant" }),
      id,
    );
    await expect(nav.getByRole("link", { name })).toHaveAttribute(
      "aria-current",
      "location",
    );
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(nav.locator("[aria-current]")).toHaveCount(0);
});

test("header retains its island layout without collisions", async ({
  page,
}) => {
  await page.goto("/");
  for (const width of [921, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator(".header-inner")).toHaveCSS(
      "border-radius",
      "999px",
    );
    const spacing = await page.evaluate(() => {
      const brand = document
        .querySelector(".header-inner .brand")!
        .getBoundingClientRect();
      const nav = document
        .querySelector(".desktop-nav")!
        .getBoundingClientRect();
      const contact = document
        .querySelector(".header-contact")!
        .getBoundingClientRect();
      return [nav.left - brand.right, contact.left - nav.right];
    });
    expect(Math.min(...spacing)).toBeGreaterThan(0);
  }
});

test("repaired logo and branded social preview remain intact", async ({
  page,
  request,
}) => {
  const mark = await request.get("/brand/mark-dark.png");
  const data = await mark.body();
  expect(data.readUInt32BE(16)).toBe(634);
  expect(data.readUInt32BE(20)).toBe(754);
  await page.goto("/");
  const box = await page.locator(".header-inner .brand-mark").boundingBox();
  expect(box!.height / box!.width).toBeCloseTo(754 / 634, 2);
  const social = await request.get("/opengraph-image");
  expect(social.ok()).toBe(true);
  expect(social.headers()["content-type"]).toContain("image/png");
});

test("metadata and visible copy retain the approved punctuation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Cinder | One account for Solana perps");
  expect(await page.locator("body").innerText()).not.toContain("—");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("button", { name: /pause/i })).toHaveCount(0);
});

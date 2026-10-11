import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function configure(page: Page) {
  await page.route("**/api/waitlist", async (route) => {
    if (route.request().method() === "GET")
      await route.fulfill({ json: { ready: true, siteKey: "mock-site-key" } });
    else
      await route.fulfill({
        json: { message: "Check your inbox for a confirmation link." },
      });
  });
  // No real challenges, email, API credentials or subscriber writes in tests.
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `window.turnstile = { render(node, options) { window.testChallenge = options; queueMicrotask(() => options.callback('mock-token')); return 'mock-widget'; }, reset() { queueMicrotask(() => window.testChallenge.callback('fresh-mock-token')); }, remove() {} };`,
      }),
  );
}

test("unconfigured form stays visibly unavailable and sends nothing", async ({
  page,
}) => {
  await page.goto("/#waitlist");
  const form = page.getByRole("form", { name: "Cinder waitlist" });
  await expect(form.getByLabel("Email address (required)")).toBeDisabled();
  await expect(
    form.getByRole("button", { name: "Join waitlist" }),
  ).toBeDisabled();
  await expect(form.getByRole("status")).toContainText("Signups open soon");
  await expect(form.getByRole("button", { name: "Check again" })).toBeVisible();
});

test("email validation, keyboard submission, pending and confirmation states", async ({
  page,
}) => {
  await configure(page);
  let submitted: unknown;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/waitlist", async (route) => {
    if (route.request().method() === "GET") return route.fallback();
    submitted = route.request().postDataJSON();
    await gate;
    await route.fulfill({
      json: { message: "Check your inbox for a confirmation link." },
    });
  });
  await page.goto("/#waitlist");
  const form = page.getByRole("form", { name: "Cinder waitlist" });
  const input = form.getByLabel("Email address (required)");
  await expect(input).toBeEnabled();
  await expect(form.getByRole("status")).toContainText("No wallet needed");
  await input.fill("not-an-email");
  await input.press("Enter");
  await expect(form.getByRole("alert")).toHaveText(
    "Enter a valid email address.",
  );
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await input.fill("hello@example.com");
  await input.press("Enter");
  await expect(form.getByRole("button", { name: "Sending…" })).toBeDisabled();
  await expect(form).toHaveAttribute("aria-busy", "true");
  expect(submitted).toMatchObject({
    email: "hello@example.com",
    token: "mock-token",
    website: "",
  });
  release();
  await expect(form.getByRole("status")).toContainText("Check your inbox");
  await expect(
    form.getByRole("button", { name: "Email requested" }),
  ).toBeDisabled();
  await expect(input).toHaveValue("hello@example.com");
  expect(page.url()).not.toContain("hello");
});

test("failed signup preserves input and permits a fresh-token retry", async ({
  page,
}) => {
  await configure(page);
  let count = 0;
  await page.route("**/api/waitlist", async (route) => {
    if (route.request().method() === "GET") return route.fallback();
    count++;
    await route.fulfill(
      count === 1
        ? {
            status: 503,
            json: {
              message:
                "Signup is temporarily unavailable. Please try again shortly.",
            },
          }
        : { json: { message: "Check your inbox." } },
    );
  });
  await page.goto("/#waitlist");
  const form = page.getByRole("form", { name: "Cinder waitlist" });
  const input = form.getByLabel("Email address (required)");
  await expect(form.getByRole("status")).toContainText("No wallet needed");
  await input.fill("hello@example.com");
  await form.getByRole("button", { name: "Join waitlist" }).click();
  await expect(form.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await expect(input).toHaveValue("hello@example.com");
  await form.getByRole("button", { name: "Join waitlist" }).click();
  await expect(form.getByRole("status")).toContainText("Check your inbox");
  expect(count).toBe(2);
});

test("blocked challenge can be retried without losing the address", async ({
  page,
}) => {
  await configure(page);
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    (route) => route.abort(),
  );
  await page.goto("/#waitlist");
  const form = page.getByRole("form", { name: "Cinder waitlist" });
  await form.getByLabel("Email address (required)").fill("hello@example.com");
  await expect(form.getByRole("alert")).toContainText(
    "Security check couldn’t load",
  );
  await page.unroute(
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
  );
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `window.turnstile = { render(node, options) { options.callback('retry-token'); return 'retry-widget'; }, reset() {}, remove() {} };`,
      }),
  );
  await form.getByRole("button", { name: "Retry security check" }).click();
  await expect(form.getByRole("alert")).toHaveCount(0);
  await expect(form.getByRole("status")).toContainText("No wallet needed");
  await expect(form.getByLabel("Email address (required)")).toHaveValue(
    "hello@example.com",
  );
});

for (const width of [375, 768, 1280]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`waitlist is usable and accessible at ${width}px in ${colorScheme}`, async ({
      page,
    }) => {
      await configure(page);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto("/#waitlist");
      const form = page.getByRole("form", { name: "Cinder waitlist" });
      await expect(form.getByRole("status")).toContainText("No wallet needed");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const audit = await new AxeBuilder({ page })
        .include("#waitlist")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        audit.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((node) => node.target),
        })),
      ).toEqual([]);
      for (const control of [
        form.getByLabel("Email address (required)"),
        form.getByRole("button", { name: "Join waitlist" }),
      ]) {
        const box = await control.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.x).toBeGreaterThanOrEqual(20);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width - 20);
      }
      await page
        .locator("#waitlist")
        .screenshot({
          path: `test-results/review/waitlist-${width}-${colorScheme}.png`,
        });
    });
  }
}

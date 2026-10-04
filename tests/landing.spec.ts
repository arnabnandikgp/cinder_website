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
    for (const image of await page.locator(".feature-preview img").all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((element: HTMLImageElement) => element.decode());
    }
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
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: `test-results/review/home-${width}.png`,
      fullPage: true,
    });
    await page.locator(".article-feature").screenshot({
      path: `test-results/review/article-${width}.png`,
    });
    for (const id of ["trading", "agents", "advantage"]) {
      await page.locator(`#${id}`).screenshot({
        path: `test-results/review/${id}-${width}.png`,
      });
    }
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
  await expect(page.locator(".product-preview img")).toHaveAttribute(
    "alt",
    /Standard trading demo.*Trade, Account, Activity and Agents/,
  );
  await expect(page.locator(".product-preview a")).toHaveCount(0);
  await expect(page.locator(".hero-intro")).toContainText("Choose your venue");
  await expect(page.locator(".hero-intro")).toContainText(
    "trading agents scoped access",
  );
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
    .getByRole("link", { name: "Explore the demo", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(
    page.getByRole("heading", { name: "Cinder trading workspace" }),
  ).toBeAttached();
});

test("story leads with trading and agents before account economics and privacy", async ({
  page,
}) => {
  await page.goto("/");
  expect(
    await page
      .locator("main > section[id]")
      .evaluateAll((nodes) => nodes.map((node) => node.id)),
  ).toEqual([
    "trading",
    "agents",
    "advantage",
    "economics",
    "privacy",
    "article",
    "faq",
  ]);
  await expect(page.locator("#economics")).toContainText(
    "Actual pricing depends on venue rules",
  );
  await expect(page.locator("#privacy")).toContainText(
    "trusted execution environment (TEE)",
  );
  await expect(page.locator("#trading")).toContainText("five-second average");
  await expect(page.locator("#agents")).toContainText("withdrawal authority");
  await expect(page.locator("#advantage")).toContainText(
    "does not imply shared cross-venue margin",
  );
  await expect(page.locator("#vision")).toHaveCount(0);
});

test("Pro preview uses 100k and sits alongside the trading copy on desktop", async ({
  page,
}) => {
  await page.goto("/");
  const preview = page.locator(".pro-feature-preview");
  await expect(preview.locator("img")).toHaveAttribute(
    "alt",
    /100,000 USDC order selected/,
  );
  for (const width of [1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const copy = await page.locator(".trading-story-copy").boundingBox();
    const image = await preview.boundingBox();
    const layout = await page.locator(".trading-story-layout").boundingBox();
    expect(copy!.x + copy!.width).toBeLessThan(image!.x);
    expect(image!.width / layout!.width).toBeLessThan(0.65);
    expect(
      Math.abs(copy!.y + copy!.height / 2 - (image!.y + image!.height / 2)),
    ).toBeLessThan(2);
  }
  await page.setViewportSize({ width: 375, height: 900 });
  const copy = await page.locator(".trading-story-copy").boundingBox();
  const image = await preview.boundingBox();
  expect(image!.y).toBeGreaterThan(copy!.y + copy!.height);
});

test("screenshots are static while separate text links open the workspace", async ({
  page,
}) => {
  await page.goto("/");
  const images = page.locator(".product-preview img, .feature-preview img");
  await expect(images).toHaveCount(4);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((element: HTMLImageElement) => element.decode());
    expect(
      await image.evaluate((element: HTMLImageElement) => element.naturalWidth),
    ).toBeGreaterThan(0);
    await expect(image).not.toHaveAttribute("alt", "");
    expect(
      await image.evaluate(
        (element) => !!element.closest("a, button, [role=link]"),
      ),
    ).toBe(false);
    await image.click();
    await expect(page).toHaveURL(/\/$/);
  }
  for (const [label, href] of [
    ["Explore Standard", "/demo"],
    ["Explore Pro", "/demo?mode=auto"],
    ["Explore Account", "/demo?view=account"],
    ["Explore Activity", "/demo?view=activity"],
  ]) {
    await expect(
      page.getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("href", href);
  }
  await expect(page.locator("#agents a")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Explore Agents", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Agent setup guide", exact: true }),
  ).toHaveAttribute(
    "href",
    "https://docs.cinder.exchange/guides/agents#agents",
  );
  await page.setViewportSize({ width: 375, height: 900 });
  await expect(page.locator(".agent-docs-link")).toHaveCSS("display", "flex");
});

test("Agents uses a readable permission diagram instead of a terminal screenshot", async ({
  page,
}) => {
  await page.goto("/");
  const agent = page.getByTestId("agent-access-diagram");
  await expect(page.locator(".agent-feature-preview")).toHaveCount(0);
  await expect(agent).toHaveAccessibleName(
    "Agent permissions and request flow",
  );
  await expect(agent).toContainText("Access granted by you");
  await expect(agent).toContainText("Trade · Cancel");
  await expect(agent).toContainText("Order limits + expiry");
  await expect(agent).toContainText("No withdrawal authority");
  await expect(agent).toContainText("Actor: SOL arbitrage");
  await expect(agent.getByText("SOL arbitrage", { exact: true })).toBeVisible();
  await expect(agent).not.toContainText("SOL strategy");
  await expect(agent.locator("a")).toHaveCount(0);
  for (const width of [375, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const agentBox = await agent.boundingBox();
    for (const preview of await page
      .locator(".account-story-grid .feature-preview")
      .all()) {
      const box = await preview.boundingBox();
      expect(Math.abs(agentBox!.width - box!.width)).toBeLessThan(2);
      expect(agentBox!.height).toBeLessThan(560);
    }
  }
});

test("agent motion pauses on demand and when outside the viewport", async ({
  page,
}) => {
  await page.goto("/");
  const diagram = page.getByTestId("agent-access-diagram");
  await diagram.scrollIntoViewIfNeeded();
  await expect(diagram).toHaveAttribute("data-playing", "true");
  const pause = page.getByRole("button", { name: "Pause agent animation" });
  await pause.focus();
  await expect(pause).toBeFocused();
  await expect(pause).toHaveCSS("outline-style", "solid");
  const target = await pause.boundingBox();
  expect(target!.width).toBeGreaterThanOrEqual(40);
  expect(target!.height).toBeGreaterThanOrEqual(40);
  await page.keyboard.press("Enter");
  await expect(diagram).toHaveAttribute("data-playing", "false");
  expect(
    await diagram.evaluate((node) =>
      node
        .getAnimations({ subtree: true })
        .every((animation) => animation.playState === "paused"),
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Resume agent animation" }).click();
  await expect(diagram).toHaveAttribute("data-playing", "true");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(diagram).toHaveAttribute("data-playing", "false");
});

test("agent request animation forwards only the permitted request", async ({
  page,
}) => {
  await page.goto("/");
  const diagram = page.getByTestId("agent-access-diagram");
  await diagram.scrollIntoViewIfNeeded();
  await expect(diagram).toHaveAttribute("data-playing", "true");
  const phase = async (fraction: number) => {
    await diagram.evaluate((node, time) => {
      for (const animation of node.getAnimations({ subtree: true })) {
        animation.pause();
        animation.currentTime = time;
      }
    }, fraction * 12000);
  };
  await phase(0.1);
  await expect(page.getByTestId("agent-allowed-request")).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(page.getByTestId("agent-forwarded-request")).toHaveCSS(
    "opacity",
    "0",
  );
  await phase(0.32);
  await expect(page.getByTestId("agent-forwarded-request")).toHaveCSS(
    "opacity",
    "1",
  );
  await diagram.screenshot({
    path: "test-results/review/agent-flow-approved.png",
  });
  await phase(0.6);
  await expect(page.getByTestId("agent-blocked-request")).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(page.getByTestId("agent-forwarded-request")).toHaveCSS(
    "opacity",
    "0",
  );
  await phase(0.8);
  const blocked = diagram.locator('[data-event="blocked"]');
  expect(
    await blocked.evaluate(
      (node) => getComputedStyle(node, "::before").opacity,
    ),
  ).toBe("1");
  await diagram.screenshot({
    path: "test-results/review/agent-flow-blocked.png",
  });
  await expect(diagram.locator('[data-event="allowed"]')).toContainText(
    "SOL order forwarded",
  );
  await expect(blocked).toContainText("Outside the authorized market");
});

test("reduced-motion agent diagram is static with both outcomes readable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const diagram = page.getByTestId("agent-access-diagram");
  await diagram.scrollIntoViewIfNeeded();
  await expect(page.getByTestId("agent-allowed-request")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(diagram.getByRole("button")).toBeHidden();
  expect(
    await diagram.evaluate(
      (node) => node.getAnimations({ subtree: true }).length,
    ),
  ).toBe(0);
  await expect(diagram.locator('[data-event="allowed"]')).toBeVisible();
  await expect(diagram.locator('[data-event="blocked"]')).toBeVisible();
  await expect(diagram).toContainText("No withdrawal authority");
});

test("FAQ accurately describes market feeds, wallet connection and preview-only actions", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("summary")
    .filter({ hasText: "Can I trade in the demo?" })
    .click();
  const answer = page.locator("details[open] p");
  await expect(answer).toContainText(
    "public market feeds from Pacifica, BULK and Phoenix",
  );
  await expect(answer).toContainText("connect a real wallet");
  await expect(answer).toContainText("no signatures, deposits or live orders");
  await page
    .locator("summary")
    .filter({ hasText: "How do trading agents fit into Cinder?" })
    .click();
  await expect(page.locator("details[open] p")).toContainText(
    "local preview, not an onchain authorization",
  );
  await page
    .locator("summary")
    .filter({ hasText: "What is the longer-term direction?" })
    .click();
  await expect(page.locator("details[open] p")).toContainText(
    "not a claim of shared cross-venue margin",
  );
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
    .getByRole("link", { name: "Agents", exact: true })
    .click();
  await expect(page).toHaveURL(/#agents$/);
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeHidden();
});

for (const width of [375, 921, 1024, 1280]) {
  test(`Docs is available in the landing header at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    if (width <= 920)
      await page.getByRole("button", { name: "Open navigation" }).click();
    const nav = page.getByRole("navigation", {
      name: width <= 920 ? "Mobile navigation" : "Main navigation",
      exact: true,
    });
    const docs = nav.getByRole("link", { name: "Docs", exact: true });
    await expect(docs).toBeVisible();
    await expect(docs).toHaveAttribute("href", "https://docs.cinder.exchange");
    await expect(docs).toHaveAttribute("rel", "noopener noreferrer");
    await expect(docs).not.toHaveAttribute("aria-current");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("navigation dot is absent at the hero and follows section visits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.locator("[aria-current]")).toHaveCount(0);
  await expect(nav.locator(".nav-indicator")).toHaveCSS("opacity", "0");
  for (const [id, name] of [
    ["trading", "Trading"],
    ["agents", "Agents"],
    ["advantage", "The account"],
    ["privacy", "Privacy"],
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

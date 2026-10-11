import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
      "A Solana-native prime broker for perps.",
    );
    await page.evaluate(() => document.fonts.ready);
    for (const image of await page.locator("main img:visible").all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((element: HTMLImageElement) => element.decode());
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
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
    for (const id of ["brokerage", "trading", "agents", "account", "thesis"]) {
      await page
        .locator("#" + id)
        .screenshot({ path: `test-results/review/${id}-${width}.png` });
    }
  });
}

test("eight-section story leads with brokerage and follows the trader’s workflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main > section")).toHaveCount(8);
  expect(
    await page
      .locator("main > section[id]")
      .evaluateAll((nodes) => nodes.map((node) => node.id)),
  ).toEqual(["brokerage", "trading", "agents", "account", "thesis", "faq"]);
  await expect(page.locator(".hero-intro")).toHaveText(
    "Private positions. Better fee tiers. Your choice of venue. All in one workspace.",
  );
  await expect(page.locator("#brokerage .landing-section-heading > p")).toHaveText(
    "Your positions stay private. Your qualifying trading volume combines with other traders’ volume to unlock lower fees at eligible venues.",
  );
  await expect(page.locator(".brokerage-principles li")).toHaveText([
    "Private positions",
    "Lower venue fees",
    "Existing liquidity",
  ]);
  await expect(page.locator("#agents")).toContainText(
    "without granting withdrawal access",
  );
  await expect(page.locator("#thesis")).toContainText("Read the article on X");
  await expect(page.locator("#trust")).toHaveCount(0);
  await expect(
    page.locator(".product-status, .brokerage-benefits, .agent-story-points"),
  ).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText(
    /five-second average|each venue’s midpoint|deployed on Solana devnet|Live market data \/ Simulated/,
  );
  await expect(page.locator("#faq details")).toHaveCount(6);
});

test("hero and closing keep primary content inside their containers", async ({
  page,
}) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    for (const selector of [".landing-hero", ".landing-closing"]) {
      const section = page.locator(selector);
      const container = await section.locator(".container").boundingBox();
      expect(container!.x).toBeGreaterThanOrEqual(20);
      expect(container!.x + container!.width).toBeLessThanOrEqual(width - 20);
      for (const content of await section
        .locator("h1, h2, .landing-actions a")
        .all()) {
        const box = await content.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(container!.x);
        expect(box!.x + box!.width).toBeLessThanOrEqual(
          container!.x + container!.width + 1,
        );
      }
      await section.screenshot({
        path: `test-results/review/${selector.slice(1)}-${width}.png`,
      });
    }
  }
});

test("hero is screenshot-free and keeps demo, video and thesis links", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.locator(".landing-hero img, .landing-hero video"),
  ).toHaveCount(0);
  await expect(page.locator(".hero-beams")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Watch launch video" }),
  ).toHaveAttribute(
    "href",
    "https://x.com/CinderExchange/status/2107457041975693801",
  );
  await expect(
    page.getByRole("link", { name: "Read the thesis" }),
  ).toHaveAttribute(
    "href",
    "https://x.com/CinderExchange/status/2104439873029685347",
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

test("light-mode depth uses blue section washes, richer panels and cobalt hero beams", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Light theme", exact: true }).click();
  const palette = await page.evaluate(() => {
    const color = (selector: string) => {
      const element = document.querySelector(selector)!;
      return getComputedStyle(element)
        .backgroundColor.match(/[\d.]+/g)!
        .map(Number);
    };
    return {
      neutral: color(".landing-site"),
      hero: color(".landing-hero"),
      trading: color("#trading"),
      agents: color("#agents"),
      panel: color(".account-stage"),
    };
  });
  expect(Math.abs(palette.neutral[2] - palette.neutral[0])).toBeLessThan(5);
  for (const surface of [
    palette.hero,
    palette.trading,
    palette.agents,
    palette.panel,
  ]) {
    expect(surface[2] - surface[0]).toBeGreaterThan(15);
  }
  // Panels read more strongly than the broad section wash.
  expect(palette.panel[0]).toBeLessThan(palette.trading[0]);
  await expect(page.locator(".hero-beams")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(page.locator(".hero-beams")).toHaveAttribute(
    "data-color",
    /#0051fe/i,
  );
});

test("brokerage diagram connects three traders and two agents through one Cinder layer", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const diagram = page.getByRole("figure", {
    name: "Traders and agents connect through one Cinder brokerage layer to venue liquidity",
  });
  const participants = diagram.locator(".brokerage-participant");
  await expect(participants).toHaveCount(5);
  await expect(participants).toHaveText([
    "Trader 01",
    "Agent 01",
    "Trader 02",
    "Agent 02",
    "Trader 03",
  ]);
  expect(
    await participants.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-kind")),
    ),
  ).toEqual(["trader", "agent", "trader", "agent", "trader"]);
  await expect(
    diagram.getByRole("heading", { name: "Traders & agents" }),
  ).toBeVisible();
  await expect(
    diagram.getByRole("img", { name: "Trader", exact: true }),
  ).toHaveCount(3);
  await expect(
    diagram.getByRole("img", { name: "Agent", exact: true }),
  ).toHaveCount(2);
  await expect(participants.locator("svg")).toHaveCount(5);
  await expect(diagram.locator('[data-kind="trader"]')).toHaveCount(3);
  await expect(diagram.locator('[data-kind="agent"]')).toHaveCount(2);
  await expect(diagram).toContainText("Private accounts & positions");
  await expect(diagram.locator(".brokerage-hub li")).toHaveCount(5);
  await expect(diagram.locator(".brokerage-hub")).toHaveCount(1);
  await expect(diagram.locator(".brokerage-hub")).toContainText(
    "Prime brokerage",
  );
  await expect(
    diagram.getByRole("button", { includeHidden: true }),
  ).toBeHidden();
  await expect(diagram.locator(".brokerage-venue")).toHaveCount(3);
  await expect(
    diagram.locator(".brokerage-participants .brokerage-venue"),
  ).toHaveCount(0);
  for (const name of ["Pacifica", "BULK", "Phoenix"]) {
    await expect(
      diagram.locator(".brokerage-venue").filter({ hasText: name }),
    ).toHaveCount(1);
  }
  await expect(diagram.getByText("Pooled volume", { exact: true })).toHaveCount(
    3,
  );
  for (const width of [375, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const individual = await diagram
      .locator(".brokerage-participants")
      .boundingBox();
    const layer = await diagram.locator(".brokerage-layer").boundingBox();
    const venues = await diagram.locator(".brokerage-venues").boundingBox();
    if (width <= 800) {
      expect(layer!.y).toBeGreaterThan(individual!.y + individual!.height);
      expect(venues!.y).toBeGreaterThan(layer!.y + layer!.height);
    } else {
      expect(layer!.x).toBeGreaterThan(individual!.x + individual!.width);
      expect(venues!.x).toBeGreaterThan(layer!.x + layer!.width);
    }
    for (const participant of await participants.all()) {
      const box = await participant.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(individual!.x);
      expect(box!.x + box!.width).toBeLessThanOrEqual(
        individual!.x + individual!.width + 1,
      );
      await expect(participant.locator("svg")).toBeVisible();
      const avatar = await participant
        .locator(".brokerage-participant-avatar")
        .boundingBox();
      const icon = await participant.locator("svg").boundingBox();
      expect(avatar!.width).toBeGreaterThanOrEqual(44);
      expect(avatar!.height).toBeGreaterThanOrEqual(44);
      expect(icon!.width).toBeGreaterThanOrEqual(28);
      expect(icon!.height).toBeGreaterThanOrEqual(28);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("brokerage comparison loops, distinguishes its states and pauses offscreen", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  const diagram = page.locator(".brokerage-map");
  await diagram.scrollIntoViewIfNeeded();
  await expect(diagram).toHaveAttribute("data-playing", "true");
  await expect(diagram).toHaveAttribute("data-phase", "0");
  await expect(diagram).toHaveAttribute("data-view", "today");
  await expect(diagram.getByRole("button")).toHaveCount(0);
  await expect(diagram).toContainText("Direct connections");
  await expect(diagram).toContainText("Cinder-routed flow");
  const path = diagram.locator('svg[viewBox="0 0 1000 432"] > path').first();
  const direct = await path.getAttribute("d");
  await page.clock.runFor(2800);
  await expect(diagram).toHaveAttribute("data-phase", "1");
  expect(await path.getAttribute("d")).not.toBe(direct);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(diagram).toHaveAttribute("data-playing", "false");
  const offscreen = await path.getAttribute("d");
  await page.clock.runFor(3000);
  expect(await path.getAttribute("d")).toBe(offscreen);
  await diagram.scrollIntoViewIfNeeded();
  await expect(diagram).toHaveAttribute("data-playing", "true");
  await page.clock.runFor(5000);
  await expect(diagram).toHaveAttribute("data-phase", "4");
  await expect(diagram).toHaveAttribute("data-view", "cinder");
  await expect(diagram).toHaveAttribute("data-playing", "true");
  await page.clock.runFor(2100);
  await expect(diagram).toHaveAttribute("data-returning", "true");
  await page.clock.runFor(1200);
  await expect(diagram).toHaveAttribute("data-phase", "0");
  await expect(diagram).toHaveAttribute("data-view", "today");
  await expect(diagram).toHaveAttribute("data-returning", "false");
  await page.clock.runFor(7500);
  await expect(diagram).toHaveAttribute("data-phase", "4");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await diagram.scrollIntoViewIfNeeded();
  await expect(diagram).toHaveAttribute("data-phase", "4");
});

test("Standard and Pro switch the actual preview and description without section demo links", async ({
  page,
}) => {
  await page.goto("/");
  const modes = page.getByRole("group", { name: "Trading mode preview" });
  await expect(
    modes.getByRole("button", { name: "Standard", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".trading-preview video:visible")).toHaveAttribute(
    "src",
    /loops\/standard.mp4/,
  );
  await expect(
    page.getByRole("link", { name: "Explore Standard", exact: true }),
  ).toHaveCount(0);
  await modes.getByRole("button", { name: "Pro", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    modes.getByRole("button", { name: "Pro", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".trading-preview video:visible")).toHaveAttribute(
    "src",
    /loops\/pro.mp4/,
  );
  await expect(page.locator(".trading-mode-copy")).toContainText(
    "estimated trading costs",
  );
  await expect(
    page.getByRole("link", { name: "Explore Pro", exact: true }),
  ).toHaveCount(0);
  const audit = await new AxeBuilder({ page })
    .include("#trading")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page
    .locator("#trading")
    .screenshot({ path: "test-results/review/trading-pro.png" });
  await modes.getByRole("button", { name: "Standard", exact: true }).click();
  await expect(page.locator(".trading-preview video:visible")).toHaveAttribute(
    "src",
    /loops\/standard.mp4/,
  );
  await expect(
    page.getByRole("link", { name: "Explore Pro", exact: true }),
  ).toHaveCount(0);
});

test("account walkthrough is keyboard accessible and stops after a deliberate choice", async ({
  page,
}) => {
  await page.goto("/");
  const controls = page.getByRole("group", { name: "Account walkthrough" });
  await controls.getByRole("button", { name: /See every position/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-scene="positions"]')).toBeVisible();
  await expect(page.locator(".illustrative-position")).toHaveCount(3);
  await expect(page.locator(".account-story")).toHaveAttribute(
    "data-advancing",
    "false",
  );
  await controls.getByRole("button", { name: /Connect every move/ }).click();
  await expect(page.locator('[data-scene="activity"]')).toBeVisible();
  await expect(page.locator(".activity-illustration li")).toHaveText([
    /Margin funded.*execution venue/,
    /Order submitted.*SOL-PERP/,
    /Fill recorded.*linked to the order/,
    /Fees recorded.*your account/,
  ]);
  await expect(controls.locator('[aria-pressed="true"]')).toHaveCount(1);
  await expect(controls.locator('[aria-expanded="true"]')).toHaveCount(1);
  await expect(
    controls.locator('[aria-expanded="false"] .account-step-detail').first(),
  ).toHaveCSS("grid-template-rows", "0px");
  await expect(page.locator(".account-stage")).toContainText(
    "Illustrative view",
  );
  for (const name of [
    "Explore Account",
    "Explore Activity",
    "Explore Agents",
  ]) {
    await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);
  }
  await expect(
    page.getByRole("link", { name: "API reference", exact: true }),
  ).toHaveAttribute("href", "https://docs.cinder.exchange/api/overview");
});

test("the article replaces the trust grid without requiring an X widget", async ({
  page,
}) => {
  await page.goto("/");
  const article = page.locator("#thesis .thesis-card");
  await expect(article).toHaveAttribute(
    "href",
    "https://x.com/CinderExchange/status/2104439873029685347",
  );
  await expect(article).toHaveAttribute("rel", "noopener noreferrer");
  await expect(article).toContainText("private positions and pooled volume");
  await expect(page.locator("#thesis iframe, #thesis script")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Explore it/ })).toHaveCount(
    0,
  );
});

test("FAQ is concise, keyboard accessible and keeps privacy and recovery boundaries", async ({
  page,
}) => {
  await page.goto("/");
  const exchange = page
    .locator("summary")
    .filter({ hasText: "Is Cinder another exchange?" });
  await exchange.click();
  await expect(page.locator("details[open] p")).toContainText(
    "Cinder is the brokerage layer",
  );
  await page
    .locator("summary")
    .filter({ hasText: "What remains private?" })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("details[open] p")).toContainText(
    "deposits and payouts remain visible on-chain",
  );
  await expect(exchange.locator("..")).not.toHaveAttribute("open");
  await page
    .locator("summary")
    .filter({ hasText: "How does pooled volume" })
    .click();
  await expect(page.locator("details[open] p")).toContainText(
    "Volume is counted separately at each venue",
  );
  await page
    .locator("summary")
    .filter({ hasText: "What if normal service" })
    .click();
  await expect(
    page.getByRole("link", { name: "Read about recovery" }),
  ).toHaveAttribute("href", "https://docs.cinder.exchange/security/recovery");
  const footer = page.getByRole("navigation", { name: "Footer navigation" });
  await expect(
    footer.getByRole("link", { name: "Contact", exact: true }),
  ).toHaveAttribute("href", "https://x.com/CinderExchange");
  await expect(footer.getByRole("link", { name: "GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/arnabnandikgp/cinder",
  );
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
    ["brokerage", "Why Cinder"],
    ["trading", "Trading"],
    ["agents", "Agents"],
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

test("header is stationary and has no island or control collisions", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".site-header")).toHaveCSS("position", "relative");
  for (const width of [921, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator(".header-inner")).toHaveCSS(
      "border-radius",
      "0px",
    );
    const spacing = await page.evaluate(() => {
      const brand = document
        .querySelector(".header-inner .brand")!
        .getBoundingClientRect();
      const nav = document
        .querySelector(".desktop-nav")!
        .getBoundingClientRect();
      const controls = document
        .querySelector(".header-actions")!
        .getBoundingClientRect();
      return [nav.left - brand.right, controls.left - nav.right];
    });
    expect(Math.min(...spacing)).toBeGreaterThan(0);
  }
  await page.locator("#brokerage").scrollIntoViewIfNeeded();
  expect((await page.locator(".site-header").boundingBox())!.y).toBeLessThan(0);
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
  const box = await page
    .locator(".header-inner .brand-mark:visible")
    .boundingBox();
  expect(box!.height / box!.width).toBeGreaterThan(1.17);
  expect(box!.height / box!.width).toBeLessThan(1.2);
  const social = await request.get("/opengraph-image");
  expect(social.ok()).toBe(true);
  expect(social.headers()["content-type"]).toContain("image/png");
});

test("metadata and reduced-motion variants retain the product’s identity", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page).toHaveTitle(
    "Cinder | A Solana-native prime broker for perps",
  );
  expect(await page.locator("body").innerText()).not.toContain("—");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /pooled trading volume/,
  );
  for (const selector of [
    ".brokerage-map",
    '[data-testid="agent-access-diagram"]',
  ]) {
    const diagram = page.locator(selector);
    await diagram.scrollIntoViewIfNeeded();
    expect(
      await diagram.evaluate(
        (node) => node.getAnimations({ subtree: true }).length,
      ),
    ).toBe(0);
    await expect(diagram.getByRole("button")).toBeHidden();
  }
});

test("server-rendered landing copy and primary links remain available without JavaScript", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(baseURL!);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "A Solana-native prime broker for perps.",
    );
    await expect(
      page.getByRole("link", { name: "Explore the demo", exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Explore Standard", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".brokerage-hub")).toHaveCount(1);
    await page.locator("summary").first().click();
    await expect(page.locator("details[open] p")).toBeVisible();
  } finally {
    await context.close();
  }
});

test("theme starts with the system, follows OS changes and remembers explicit choices", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const surface = page.locator(".landing-site");
  await expect(
    page.getByRole("button", { name: "System theme", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(surface).toHaveCSS("background-color", "rgb(250, 250, 251)");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(surface).toHaveCSS("background-color", "rgb(11, 11, 11)");
  await page.getByRole("button", { name: "Light theme", exact: true }).click();
  await expect(surface).toHaveCSS("background-color", "rgb(250, 250, 251)");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Light theme", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(surface).toHaveCSS("background-color", "rgb(250, 250, 251)");
  await page.getByRole("button", { name: "System theme", exact: true }).click();
  await expect(surface).toHaveCSS("background-color", "rgb(11, 11, 11)");
});

for (const width of [375, 768, 1280]) {
  test(`dark theme passes accessibility and layout checks at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await expect(page.locator(".landing-site")).toHaveCSS(
      "background-color",
      "rgb(11, 11, 11)",
    );
    const audit = await new AxeBuilder({ page })
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
    await page.screenshot({
      path: `test-results/review/dark-${width}.png`,
      fullPage: true,
    });
  });
}

test("product loops play only while selected and visible and can be paused", async ({
  page,
}) => {
  await page.goto("/");
  const standard = page.locator(
    'video[aria-label="Recorded Standard trading flow"]',
  );
  const pro = page.locator('video[aria-label="Recorded Pro trading flow"]');
  expect(await standard.evaluate((e: HTMLVideoElement) => e.paused)).toBe(true);
  await page.locator("#trading").scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Pause Standard preview" }),
  ).toBeVisible();
  expect(await standard.evaluate((e: HTMLVideoElement) => e.playbackRate)).toBe(
    1.35,
  );
  await page.getByRole("button", { name: "Pause Standard preview" }).click();
  await expect
    .poll(() => standard.evaluate((e: HTMLVideoElement) => e.paused))
    .toBe(true);
  await page.getByRole("button", { name: "Play Standard preview" }).click();
  await expect
    .poll(() => standard.evaluate((e: HTMLVideoElement) => e.paused))
    .toBe(false);
  expect(await standard.evaluate((e: HTMLVideoElement) => e.playbackRate)).toBe(
    1.35,
  );
  await page
    .getByRole("group", { name: "Trading mode preview" })
    .getByRole("button", { name: "Pro", exact: true })
    .click();
  await expect
    .poll(() => standard.evaluate((e: HTMLVideoElement) => e.paused))
    .toBe(true);
  // Selecting the mode can scroll its button into view, leaving the clip
  // mostly below the fold. Playback should start only once the clip is visible.
  await page.locator(".trading-preview").scrollIntoViewIfNeeded();
  await expect
    .poll(() => pro.evaluate((e: HTMLVideoElement) => e.paused))
    .toBe(false);
  expect(await pro.evaluate((e: HTMLVideoElement) => e.playbackRate)).toBe(1);
  expect(await pro.evaluate((e: HTMLVideoElement) => e.duration)).toBeCloseTo(
    19,
    1,
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect
    .poll(() => pro.evaluate((e: HTMLVideoElement) => e.paused))
    .toBe(true);
  await expect(pro).toHaveAttribute("preload", "none");
  expect(
    await pro.evaluate(
      (e: HTMLVideoElement) => e.muted && e.loop && e.playsInline,
    ),
  ).toBe(true);
});

test("reduced motion shows posters and a manual account sequence", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator("#trading").scrollIntoViewIfNeeded();
  const video = page.locator("video:visible");
  await expect(video).toHaveAttribute("poster", /standard.webp/);
  expect(await video.evaluate((e: HTMLVideoElement) => e.paused)).toBe(true);
  await page.locator("#account").scrollIntoViewIfNeeded();
  await expect(page.locator(".account-story")).toHaveAttribute(
    "data-advancing",
    "false",
  );
  await expect(
    page.getByRole("button", { name: "Pause account walkthrough" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /See every position/ }).click();
  await expect(page.locator('[data-scene="positions"]')).toBeVisible();
});

test("guided product footage keeps its full camera aperture on every screen size", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    for (const mode of ["Standard", "Pro"]) {
      await page
        .getByRole("group", { name: "Trading mode preview" })
        .getByRole("button", { name: mode, exact: true })
        .click();
      const frame = page.locator(".product-loop:visible .product-loop-frame");
      const box = await frame.boundingBox();
      expect(box!.width / box!.height).toBeCloseTo(1440 / 710, 2);
      await expect(page.locator("video:visible")).toHaveCSS(
        "object-fit",
        "cover",
      );
    }
  }
});

test("the account sequence advances in view and pauses out of view", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#account").scrollIntoViewIfNeeded();
  await expect(page.locator(".account-story")).toHaveAttribute(
    "data-advancing",
    "true",
  );
  await expect(page.locator('[data-scene="positions"]')).toBeVisible({
    timeout: 9000,
  });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(page.locator(".account-story")).toHaveAttribute(
    "data-advancing",
    "false",
  );
});

test("theme still works when browser storage is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Dark theme", exact: true }).click();
  await expect(page.locator(".landing-site")).toHaveCSS(
    "background-color",
    "rgb(11, 11, 11)",
  );
  await expect(
    page.getByRole("button", { name: "Dark theme", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("changing the marketing theme does not retheme the trading terminal", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Light theme", exact: true }).click();
  await page
    .getByRole("link", { name: "Explore the demo", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.locator(".landing-site")).toHaveCount(0);
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(11, 11, 11)",
  );
  await expect(page.locator("body")).toHaveCSS("font-family", /Arial/);
});

test("a failed product video retains its poster and the main demo entry point", async ({
  page,
}) => {
  await page.route("**/previews/loops/standard.mp4", (route) => route.abort());
  await page.goto("/");
  await page.locator(".trading-preview").scrollIntoViewIfNeeded();
  await expect(
    page.locator('.product-loop[data-mode="standard"]'),
  ).toContainText("Video unavailable");
  await expect(
    page.locator('.product-loop[data-mode="standard"] img'),
  ).toHaveAttribute("src", /standard.webp/);
  await expect(
    page.getByRole("link", { name: "Explore the demo", exact: true }).first(),
  ).toHaveAttribute("href", "/demo");
});

test("theme choice survives a storage write failure for the current page", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Dark theme", exact: true }).click();
  await expect(page.locator(".landing-site")).toHaveCSS(
    "background-color",
    "rgb(11, 11, 11)",
  );
  await expect(
    page.getByRole("button", { name: "Dark theme", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

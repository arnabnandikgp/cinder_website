import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  TOUR_SEEN_KEY,
  tourLayout,
  tourOverviewShape,
  tourSteps,
  type TourRect,
} from "../src/components/demo/terminal-tour";
import { mockMarketData } from "./helpers/market-data";
import { chooseVenue } from "./helpers/venue-select";

const tour = (page: Page) => page.locator(".d-tour-dialog");
async function atStep(page: Page, index: number) {
  await expect(tour(page)).toBeVisible();
  await expect(tour(page)).toHaveAttribute(
    "data-tour-step",
    tourSteps[index].id,
  );
  await expect(tour(page).getByRole("heading")).toHaveText(
    tourSteps[index].title,
  );
  await expect(tour(page).getByRole("heading")).toBeFocused();
  await expect(page.getByTestId("tour-card")).toHaveCSS("opacity", "1");
  await expect(page.getByTestId("tour-card")).not.toHaveCSS(
    "box-shadow",
    "none",
  );
}
async function geometry(page: Page, width: number, height: number) {
  const card = await page.getByTestId("tour-card").boundingBox();
  const frame = await page.getByTestId("tour-spotlight").boundingBox();
  expect(card).not.toBeNull();
  expect(frame).not.toBeNull();
  for (const box of [card!, frame!]) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
  }
  if ((await tour(page).getAttribute("data-presentation")) === "overview") {
    // Only the content below the header and its active tab are clear. A single
    // outline connects them, with no seam between tab and workspace.
    const header = (await page.locator(".d-header").boundingBox())!;
    const active = (await page
      .locator('.d-header nav [aria-current="page"]')
      .boundingBox())!;
    const notch = (await page.getByTestId("tour-navigation").boundingBox())!;
    expect(frame!.x).toBe(4);
    expect(frame!.y).toBeCloseTo(header.y + header.height, 1);
    expect(frame!.width).toBe(width - 8);
    expect(frame!.height).toBeCloseTo(height - 4 - frame!.y, 1);
    await expect(page.getByTestId("tour-navigation")).toBeVisible();
    expect(notch.x).toBeLessThanOrEqual(active.x);
    expect(notch.x + notch.width).toBeGreaterThanOrEqual(
      active.x + active.width,
    );
    expect(notch.y).toBeLessThanOrEqual(active.y);
    expect(notch.y + notch.height).toBeCloseTo(frame!.y, 1);
    await expect(page.getByTestId("tour-overview-outline")).toHaveCount(1);
    await expect(page.locator(".d-tour-overview")).toHaveCSS(
      "border-top-width",
      "0px",
    );
    const shades = await page.locator(".d-tour-shade").evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return {
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
        };
      }),
    );
    const shaded = (x: number, y: number) =>
      shades.some((box) => covers(box, x, y));
    expect(
      shaded(active.x + active.width / 2, active.y + active.height / 2),
    ).toBe(false);
    expect(shaded(frame!.x + frame!.width / 2, frame!.y + 12)).toBe(false);
    for (const control of await page
      .locator(
        '.d-brand-tools, .d-account-actions, .d-header nav button:not([aria-current="page"])',
      )
      .all()) {
      const box = (await control.boundingBox())!;
      expect(shaded(box.x + box.width / 2, box.y + box.height / 2)).toBe(true);
    }
  } else {
    expect(
      card!.x >= frame!.x + frame!.width ||
        frame!.x >= card!.x + card!.width ||
        card!.y >= frame!.y + frame!.height ||
        frame!.y >= card!.y + card!.height,
    ).toBe(true);
  }
  for (const button of await tour(page).getByRole("button").all()) {
    await expect(button).toBeInViewport();
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(40);
  }
}

function covers(box: TourRect, x: number, y: number) {
  return (
    x >= box.left &&
    x < box.left + box.width &&
    y >= box.top &&
    y < box.top + box.height
  );
}

test("tour layout keeps the subject separate from side and bottom callouts", () => {
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 768, height: 900 },
    { width: 1280, height: 720 },
  ]) {
    for (const target of [
      { left: 0, top: 24, width: viewport.width, height: viewport.height },
      { left: viewport.width - 300, top: 128, width: 290, height: 180 },
      { left: 4, top: 24, width: 120, height: 80 },
    ]) {
      const { frame, card } = tourLayout(target, viewport, {
        width: 360,
        height: 280,
      });
      expect(frame).not.toBeNull();
      expect(card.left + card.width).toBeLessThanOrEqual(viewport.width);
      expect(card.top + card.height).toBeLessThanOrEqual(viewport.height);
      expect(
        card.left >= frame!.left + frame!.width ||
          frame!.left >= card.left + card.width ||
          card.top >= frame!.top + frame!.height ||
          frame!.top >= card.top + card.height,
      ).toBe(true);
    }
  }
  const fallback = tourLayout(
    null,
    { width: 375, height: 667 },
    { width: 360, height: 280 },
  );
  expect(fallback.frame).toBeNull();
  expect(fallback.card.top).toBe((667 - 280) / 2);
  const overview = tourLayout(
    { left: 0, top: 70, width: 1280, height: 650 },
    { width: 1280, height: 720 },
    { width: 400, height: 250 },
    "overview",
  );
  expect(overview.frame).toEqual({
    left: 4,
    top: 64,
    width: 1272,
    height: 652,
  });
  expect(overview.card).toEqual({
    left: 864,
    top: 454,
    width: 400,
    height: 250,
  });
  expect(overview.side).toBe("overlay");
});

test("overview mask joins only the active tab to the content and dims the remaining header", () => {
  for (const [viewport, frame, navigation] of [
    [
      { width: 1280, height: 720 },
      { left: 4, top: 64, width: 1272, height: 652 },
      { left: 400, top: 4, width: 128, height: 56 },
    ],
    [
      { width: 375, height: 667 },
      { left: 4, top: 170, width: 367, height: 493 },
      { left: 6, top: 104, width: 124, height: 56 },
    ],
    [
      { width: 375, height: 667 },
      { left: 4, top: 170, width: 367, height: 493 },
      { left: 245, top: 104, width: 124, height: 56 },
    ],
  ] as const) {
    const shape = tourOverviewShape(frame, navigation, viewport);
    expect(shape.notch).toEqual({
      ...navigation,
      height: frame.top - navigation.top,
    });
    expect(shape.shades).toHaveLength(6);
    expect(shape.outline.match(/M /g)).toHaveLength(1);
    expect(shape.outline.endsWith(" Z")).toBe(true);
    const notch = shape.notch!;
    for (const shade of shape.shades) {
      expect(shade.left).toBeGreaterThanOrEqual(0);
      expect(shade.top).toBeGreaterThanOrEqual(0);
      expect(shade.width).toBeGreaterThanOrEqual(0);
      expect(shade.height).toBeGreaterThanOrEqual(0);
      expect(shade.left + shade.width).toBeLessThanOrEqual(viewport.width);
      expect(shade.top + shade.height).toBeLessThanOrEqual(viewport.height);
    }
    expect(
      shape.shades.reduce((sum, box) => sum + box.width * box.height, 0),
    ).toBe(
      viewport.width * viewport.height -
        frame.width * frame.height -
        notch.width * notch.height,
    );
    for (let y = 2; y < viewport.height; y += 17) {
      for (let x = 2; x < viewport.width; x += 17) {
        expect(shape.shades.filter((box) => covers(box, x, y)).length).toBe(
          covers(frame, x, y) || covers(notch, x, y) ? 0 : 1,
        );
      }
    }
  }
  const viewport = { width: 1280, height: 720 };
  const frame = { left: 4, top: 64, width: 1272, height: 652 };
  expect(tourOverviewShape(frame, null, viewport).notch).toBeNull();
  expect(tourOverviewShape(frame, null, viewport).shades).toHaveLength(4);
  expect(
    tourOverviewShape(
      frame,
      { left: 400, top: 64, width: 128, height: 56 },
      viewport,
    ).notch,
  ).toBeNull();
});

test.describe("first visit", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.beforeEach(async ({ page }) => {
    await mockMarketData(page, { stream: true, phoenix: true });
  });

  test("opens once, can skip immediately and remembers the preference on reload", async ({
    page,
  }) => {
    await page.goto("/demo?venue=bulk&view=activity&filter=funding");
    const url = page.url();
    await atStep(page, 0);
    await expect(tour(page).locator(".d-tour-modes dt")).toHaveText([
      "Standard",
      "Pro",
    ]);
    await expect(tour(page)).toContainText("Choose a venue and trade");
    await expect(tour(page)).toContainText(
      "Compare estimated price cost and venue fees",
    );
    await tour(page).getByRole("button", { name: "Skip tour" }).click();
    await expect(tour(page)).toHaveCount(0);
    expect(page.url()).toBe(url);
    await expect(
      page.getByRole("button", { name: "Activity", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      await page.evaluate((key) => localStorage.getItem(key), TOUR_SEEN_KEY),
    ).toBe("seen");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Take a tour" }),
    ).toBeVisible();
    await expect(tour(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Take a tour" }).click();
    await atStep(page, 0);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Take a tour" }),
    ).toBeFocused();
  });

  test("walks all ten stops including Pro and Agents, finishes without rewriting URL or records", async ({
    page,
  }) => {
    await page.goto(
      "/demo?mode=auto&venue=phoenix&market=BTC&scope=phoenix&record=funding&panel=price&chart=bulk&analysis=average",
    );
    const url = page.url();
    await atStep(page, 0);
    expect(tourSteps.map((step) => step.id)).toEqual([
      "modes",
      "standard",
      "standard-workspace",
      "pro-workspace",
      "pro-cost",
      "account-overview",
      "account",
      "activity-overview",
      "activity",
      "agents-overview",
    ]);
    await expect(page.locator(".d-mode-switch")).toBeInViewport();
    for (let index = 1; index < tourSteps.length; index++) {
      await tour(page)
        .getByRole("button", { name: "Next", exact: true })
        .click();
      await atStep(page, index);
      expect(page.url()).toBe(url);
      const step = tourSteps[index];
      if (step.id === "standard") {
        await expect(
          tour(page).locator(".d-tour-meta > span").first(),
        ).toHaveText("STANDARD MODE");
        await expect(page.getByLabel("Execution venue")).toHaveAttribute(
          "data-value",
          "phoenix",
        );
        await tour(page)
          .getByRole("button", { name: "Back", exact: true })
          .click();
        await atStep(page, 0);
        await tour(page)
          .getByRole("button", { name: "Next", exact: true })
          .click();
        await atStep(page, 1);
      } else if (step.id === "standard-workspace") {
        for (const selector of [
          ".d-market",
          ".d-book",
          ".d-ticket",
          ".d-records",
        ]) {
          await expect(page.locator(selector)).toBeVisible();
        }
        await expect(page.locator(".d-tour-shade")).toHaveCount(6);
        await expect(tour(page)).toHaveAttribute(
          "data-presentation",
          "overview",
        );
        await expect(page.locator(".d-mode-switch")).toBeInViewport();
        expect(
          await page.locator(".d-ticket").evaluate((node) => node.scrollTop),
        ).toBe(0);
      } else if (step.id === "pro-workspace" || step.id === "pro-cost") {
        await expect(
          page.getByRole("radio", { name: "Pro", exact: true }),
        ).toBeChecked();
        await expect(page.locator(".d-book")).toHaveCount(0);
        await expect(page.locator(".d-cost-plot")).toBeVisible();
        await expect(page.locator("#d-route-comparison")).toBeVisible();
        await expect(page.locator(".d-ticket")).toBeVisible();
        await expect(page.locator(".d-records")).toBeVisible();
        await expect(page.locator(".d-cost-svg")).toHaveAttribute(
          "data-analysis-mode",
          "live",
        );
        await expect(page.locator(".d-cost-line")).toHaveCount(3);
        if (step.id === "pro-workspace") {
          await expect(tour(page)).toHaveAttribute(
            "data-presentation",
            "overview",
          );
          await expect(page.locator(".d-mode-switch")).toBeInViewport();
        } else {
          await expect(tour(page)).toContainText("in basis points");
          await expect(tour(page)).toContainText("not guaranteed fills");
          await tour(page)
            .getByRole("button", { name: "Back", exact: true })
            .click();
          await atStep(page, index - 1);
          await tour(page)
            .getByRole("button", { name: "Next", exact: true })
            .click();
          await atStep(page, index);
        }
      } else if (
        step.id === "account-overview" ||
        step.id === "activity-overview" ||
        step.id === "agents-overview"
      ) {
        const name =
          step.id === "account-overview"
            ? "Account"
            : step.id === "agents-overview"
              ? "Agents"
              : "Activity";
        await expect(
          page.getByRole("button", { name, exact: true }),
        ).toHaveAttribute("aria-current", "page");
        await expect(page.getByTestId("tour-navigation")).toBeVisible();
        await expect(tour(page)).toHaveAttribute(
          "data-presentation",
          "overview",
        );
        await expect(page.locator(".d-view-heading")).toBeInViewport();
        expect(
          await page
            .locator(".d-account-content")
            .evaluate((node) => node.scrollTop),
        ).toBe(0);
      }
    }
    await tour(page)
      .getByRole("button", { name: "Finish", exact: true })
      .click();
    await expect(tour(page)).toHaveCount(0);
    expect(page.url()).toBe(url);
    await expect(
      page.getByRole("radio", { name: "Pro", exact: true }),
    ).toBeChecked();
    await expect(
      page.getByRole("tab", { name: "Price chart", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await page
      .getByRole("tab", { name: "Execution cost", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "5s average", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Order size", { exact: true })).toHaveValue(
      "10000",
    );
    await expect(
      page.getByRole("tab", { name: "Funding history", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.locator(".d-records").getByLabel("Venue", { exact: true }),
    ).toHaveValue("phoenix");
    await expect(page.locator(".d-feedback-note")).toHaveCount(0);
  });

  test("blocked storage never blocks Skip or replay", async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw new DOMException("Blocked", "SecurityError");
      };
      Storage.prototype.setItem = () => {
        throw new DOMException("Blocked", "SecurityError");
      };
    });
    await page.goto("/demo");
    await atStep(page, 0);
    await page.keyboard.press("Escape");
    await expect(tour(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Account", exact: true }).click();
    await expect(tour(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Take a tour" }).click();
    await atStep(page, 0);
    await tour(page).getByRole("button", { name: "Skip tour" }).click();
    await expect(
      page.getByRole("button", { name: "Account", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  });

  for (const [width, height] of [
    [375, 667],
    [375, 900],
    [768, 900],
    [1280, 720],
    [1440, 900],
  ]) {
    test(`all ten tour cards fit ${width}×${height} with clear page overviews`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height });
      await page.goto("/demo");
      for (let index = 0; index < tourSteps.length; index++) {
        await atStep(page, index);
        await geometry(page, width, height);
        // Capture the populated Pro view, not its normal asynchronous startup.
        // The separate offline test ensures navigation never waits for feeds.
        if (tourSteps[index].id === "pro-workspace")
          await expect(page.locator(".d-cost-line")).toHaveCount(3);
        await page.screenshot({
          path: testInfo.outputPath(`${tourSteps[index].id}.png`),
          animations: "disabled",
        });
        if (index < tourSteps.length - 1)
          await tour(page)
            .getByRole("button", { name: "Next", exact: true })
            .click();
      }
      await tour(page)
        .getByRole("button", { name: "Finish", exact: true })
        .click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(await page.evaluate(() => scrollY)).toBe(0);
    });
  }

  test("resizing an open tour repositions its target and reduced motion removes the entrance", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/demo");
    await atStep(page, 0);
    await tour(page).getByRole("button", { name: "Next", exact: true }).click();
    await atStep(page, 1);
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByTestId("tour-card")).toHaveCSS(
      "animation-name",
      "none",
    );
    await expect(async () => {
      await geometry(page, 375, 667);
    }).toPass();
  });

  test("overview notch follows the active tab when the header wraps on resize", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/demo");
    for (let index = 0; index < tourSteps.length; index++) {
      await atStep(page, index);
      if (tourSteps[index].presentation === "overview") {
        await page.setViewportSize({ width: 375, height: 667 });
        await expect(async () => {
          await geometry(page, 375, 667);
        }).toPass();
        await page.setViewportSize({ width: 1440, height: 900 });
        await expect(async () => {
          await geometry(page, 1440, 900);
        }).toPass();
      }
      await tour(page)
        .getByRole("button", {
          name: index === tourSteps.length - 1 ? "Finish" : "Next",
          exact: true,
        })
        .click();
    }
  });

  test("offline feeds do not gate Next or Skip and the modal is accessible", async ({
    page,
  }) => {
    await page.route(
      /https:\/\/(api\.pacifica\.fi|mainnet-api1\.bulk\.trade|perp-api\.phoenix\.trade)\//,
      (route) => route.fulfill({ status: 503, body: "Unavailable" }),
    );
    await page.goto("/demo");
    await atStep(page, 0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.keyboard.press("Tab");
    await expect(
      tour(page).getByRole("button", { name: "Skip tour" }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      tour(page).getByRole("button", { name: "Next", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      tour(page).getByRole("button", { name: "Skip tour" }),
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Enter");
    await atStep(page, 1);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    for (let index = 2; index <= 4; index++) {
      await tour(page)
        .getByRole("button", { name: "Next", exact: true })
        .click();
      await atStep(page, index);
      if (tourSteps[index].id.startsWith("pro-")) {
        await expect(page.locator("#d-route-comparison")).toBeVisible();
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
      }
    }
    await page.keyboard.press("Escape");
    await expect(tour(page)).toHaveCount(0);
  });
});

test("replay preserves both order tickets, saved draft, URL and account, with no external writes", async ({
  page,
}) => {
  await mockMarketData(page, { stream: true, phoenix: true });
  const writes: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url());
  });
  await page.goto("/demo");
  await expect(page.getByTestId("book-status")).toHaveText("Live");
  await chooseVenue(page, "Execution venue", "bulk");
  await page.getByLabel("Order size", { exact: true }).fill("5678");
  await page.getByLabel("Limit price", { exact: true }).fill("123.45");
  await page
    .getByRole("button", { name: "Review buy order", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save example draft" })
    .click();
  await page.getByRole("radio", { name: "Pro", exact: true }).check();
  await page.getByLabel("Order size", { exact: true }).fill("12345");
  await page.getByRole("radio", { name: "Sell / Short" }).check();
  await page.getByLabel("Price tolerance").fill("0.7");
  const url = page.url();
  await page.getByRole("button", { name: "Take a tour" }).click();
  for (let index = 0; index < tourSteps.length; index++) {
    await atStep(page, index);
    await tour(page)
      .getByRole("button", {
        name: index === tourSteps.length - 1 ? "Finish" : "Next",
        exact: true,
      })
      .click();
  }
  expect(page.url()).toBe(url);
  await expect(page.getByLabel("Order size", { exact: true })).toHaveValue(
    "12345",
  );
  await expect(page.getByRole("radio", { name: "Sell / Short" })).toBeChecked();
  await expect(page.getByLabel("Price tolerance")).toHaveValue("0.7");
  await expect(page.getByRole("button", { name: "Take a tour" })).toBeFocused();
  await page.getByRole("radio", { name: "Standard", exact: true }).check();
  await expect(page.getByLabel("Order size", { exact: true })).toHaveValue(
    "5678",
  );
  await expect(page.getByLabel("Limit price", { exact: true })).toHaveValue(
    "123.45",
  );
  await expect(page.getByLabel("Execution venue")).toHaveAttribute(
    "data-value",
    "bulk",
  );
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page.locator(".d-events")).toContainText("DRAFT-1");
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.getByTestId("margin-committed")).toHaveText(
    "2,600.00 USDC",
  );
  expect(writes).toEqual([]);
});

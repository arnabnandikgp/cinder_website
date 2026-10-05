import { mockWallet, connectWallet } from "./helpers/wallet";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  feeBasisKey,
  parseVenueFee,
  volumeRequirement,
} from "../src/components/demo/market-data/fees";
import {
  bulkFees,
  mockMarketData,
  pacificaFees,
  phoenixInfo,
} from "./helpers/market-data";

const now = Date.UTC(2026, 9, 4, 12);

test("official volume schedules select minimum taker rates with explicit qualifications", () => {
  const pac = parseVenueFee("pacifica", "SOL", pacificaFees(), now)!;
  const bulk = parseVenueFee("bulk", "SOL", bulkFees(), now)!;
  expect(pac.takerBps).toBeCloseTo(2.8);
  expect(pac.volumeTier).toMatchObject({
    tier: "VIP 3",
    baseTakerBps: 4,
    thresholdUsd: 500_000_000,
    thresholdInclusive: false,
    windowDays: 30,
    completedUtcDays: false,
  });
  expect(volumeRequirement(pac.volumeTier!)).toBe("> $500M executed volume");
  expect(bulk.takerBps).toBe(2.2);
  expect(bulk.volumeTier).toMatchObject({
    baseTakerBps: 3.5,
    thresholdUsd: 4_000_000_000,
    thresholdInclusive: true,
    windowDays: 14,
    completedUtcDays: true,
  });
  expect(volumeRequirement(bulk.volumeTier!)).toBe("≥ $4B executed volume");
  expect(pac.label).toContain("assumed");
  expect(bulk.label).toContain("assumed");
});

test("selection uses the minimum rate, not row order or unrelated maker rebates", () => {
  const pac = pacificaFees();
  pac.data.reverse();
  expect(parseVenueFee("pacifica", "BTC", pac, now)!.takerBps).toBeCloseTo(2.8);
  const bulk = bulkFees();
  bulk.scopes[0].active_policy.tiers.reverse();
  bulk.scopes[0].active_policy.maker_share_tiers[0].rebate_bps = -100;
  expect(parseVenueFee("bulk", "BTC", bulk, now)!.takerBps).toBe(2.2);
});

test("active BULK instrument pricing overrides the cheapest global tier", () => {
  const bulk = bulkFees();
  const scopes = [
    ...bulk.scopes,
    {
      instrument: "SOL-USD",
      active_policy: {
        window_days: 7,
        tiers: [
          { threshold_volume: 0, taker_bps: 8 },
          { threshold_volume: 10_000, taker_bps: 6 },
        ],
      },
    },
  ];
  const sol = parseVenueFee("bulk", "SOL", { ...bulk, scopes }, now)!;
  expect(sol.takerBps).toBe(6);
  expect(sol.volumeTier).toMatchObject({ thresholdUsd: 10_000, windowDays: 7 });
  expect(sol.label).toContain("instrument");
  expect(parseVenueFee("bulk", "BTC", { ...bulk, scopes }, now)!.takerBps).toBe(
    2.2,
  );
  expect(
    parseVenueFee(
      "bulk",
      "SOL",
      {
        ...bulk,
        scopes: [...bulk.scopes, { instrument: "SOL-USD", active_policy: {} }],
      },
      now,
    ),
  ).toBeNull();
});

test("malformed schedules fail closed; unknown Pacifica levels never invent qualification", () => {
  const pac = pacificaFees();
  pac.data[7].taker_fee_rate = "invalid";
  expect(parseVenueFee("pacifica", "SOL", pac, now)).toBeNull();
  const bulk = bulkFees();
  bulk.scopes[0].active_policy.tiers[7].threshold_volume = NaN;
  expect(parseVenueFee("bulk", "SOL", bulk, now)).toBeNull();
  const future = pacificaFees();
  future.data.push({ level: 8, taker_fee_rate: "0.0002" });
  const fee = parseVenueFee("pacifica", "SOL", future, now)!;
  expect(fee.takerBps).toBe(2);
  expect(fee.volumeTier!.thresholdUsd).toBeNull();
  expect(volumeRequirement(fee.volumeTier!)).toContain("See venue schedule");
});

test("Phoenix remains on its market fee and polling timestamps do not change the fee basis", () => {
  const phoenix = parseVenueFee("phoenix", "SOL", phoenixInfo(), now)!;
  expect(phoenix.takerBps).toBe(3.5);
  expect(phoenix.volumeTier).toBeUndefined();
  const fee = parseVenueFee("pacifica", "SOL", pacificaFees(), now)!;
  expect(feeBasisKey(fee)).toBe(feeBasisKey({ ...fee, fetchedAt: now + 1000 }));
  expect(feeBasisKey(fee)).not.toBe(feeBasisKey({ ...fee, takerBps: 2.7 }));
});

test.beforeEach(async ({ page }) => {
  await mockWallet(page);
});

for (const width of [375, 1280]) {
  test(`volume fee information is accessible and fits the ${width}px terminal`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await mockMarketData(page, { stream: true, phoenix: true });
    await page.goto("/demo?mode=auto");
    await expect(page.getByTestId("comparison-status")).toContainText(
      "3 venues",
    );
    const table = page.getByLabel("Venue comparison table");
    await expect(
      table.getByRole("button", { name: /volume-tier fee information/ }),
    ).toHaveCount(2);
    await expect(
      table.getByRole("button", { name: /Phoenix volume-tier/ }),
    ).toHaveCount(0);
    for (const [venue, rate, threshold, window] of [
      [
        "Pacifica",
        "0.028% · 2.80 bps",
        "> $500M executed volume",
        "30 rolling days",
      ],
      [
        "BULK",
        "0.022% · 2.20 bps",
        "≥ $4B executed volume",
        "14 completed UTC days",
      ],
    ]) {
      const button = table.getByRole("button", {
        name: `${venue} volume-tier fee information`,
      });
      await button.scrollIntoViewIfNeeded();
      const bounds = (await button.boundingBox())!;
      expect(bounds.width).toBeGreaterThanOrEqual(40);
      expect(bounds.height).toBeGreaterThanOrEqual(40);
      await button.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", {
        name: `${venue} volume-tier fees`,
      });
      await expect(dialog).toContainText(rate);
      await expect(dialog).toContainText(threshold);
      await expect(dialog).toContainText(window);
      await expect(dialog).toContainText("eligibility has not been verified");
      await expect(dialog).toContainText(
        "Maker rebates and Cinder pricing are not included",
      );
      await expect(dialog.getByRole("link")).toHaveAttribute(
        "href",
        venue === "Pacifica"
          ? "https://docs.pacifica.fi/trading-on-pacifica/trading-fees"
          : "https://docs.bulk.trade/bulk-exchange/fees",
      );
      const box = (await dialog.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(
        (await new AxeBuilder({ page }).include("dialog").analyze()).violations,
      ).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(button).toBeFocused();
    }
    await page.screenshot({
      path: `/private/tmp/cinder-fee-tier-${width}.png`,
      fullPage: true,
    });
  });
}

test("live comparison, five-second average and saved preview share the modeled fee basis", async ({
  page,
}) => {
  await mockMarketData(page, { stream: true, phoenix: true });
  await page.goto("/demo?mode=auto");
  await connectWallet(page);
  await expect(page.getByTestId("comparison-status")).toContainText("3 venues");
  for (const [venue, rate] of [
    ["pacifica", 2.8],
    ["bulk", 2.2],
    ["phoenix", 3.5],
  ] as const) {
    const row = page.getByTestId(`route-row-${venue}`);
    await expect(row.locator(".d-cost-bps")).toHaveCount(3);
    const values = (await row.locator(".d-cost-bps").allTextContents()).map(
      (v) => parseFloat(v),
    );
    expect(values[1]).toBeCloseTo(rate, 1);
    expect(values[0] + values[1]).toBeCloseTo(values[2], 1);
  }
  await page.getByRole("button", { name: "5s average", exact: true }).click();
  await expect(page.getByTestId("analysis-status")).toContainText(
    "paired samples",
    { timeout: 8000 },
  );
  await page.getByRole("button", { name: "Place buy order" }).click();
  await expect(page.locator(".d-paper-table")).toContainText("Long");
  await expect(page.locator(".d-feedback-note")).toHaveCount(0);
  await page.getByRole("tab", { name: "Order history" }).click();
  await page.locator(".d-paper-table .d-cell-link").first().click();
  await expect(page.getByRole("dialog")).toContainText("2.80 bps");
  await expect(page.getByRole("dialog")).toContainText("Modeled venue fee");
});

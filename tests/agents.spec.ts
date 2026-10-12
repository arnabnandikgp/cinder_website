import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { isAgentPublicKey, sampleAgents } from "../src/components/demo/agents";
import { activityFor, matchesActor } from "../src/components/demo/activity";
import { mockMarketData } from "./helpers/market-data";

test.beforeEach(async ({ page }) => {
  await mockMarketData(page, { stream: true });
});

test("public keys are structurally 32 bytes, never secret-key material", () => {
  for (const agent of sampleAgents)
    expect(isAgentPublicKey(agent.publicKey)).toBe(true);
  for (const key of [
    "",
    "1".repeat(32),
    "2".repeat(32),
    "F".repeat(88),
    "[1,2,3]",
    "seed phrase words",
    "0".repeat(44),
  ]) {
    expect(isAgentPublicKey(key)).toBe(false);
  }
});

test("agent timeline contains requests and linked fees, never funding", () => {
  const events = activityFor("funded", "none", []);
  const agent = events.filter((event) => matchesActor(event, "sol-execution"));
  expect(agent.some((event) => event.title === "Agent order cancelled")).toBe(
    true,
  );
  expect(agent.some((event) => event.title === "Order request rejected")).toBe(
    true,
  );
  expect(
    agent
      .filter((event) => event.category === "fees")
      .every((event) => event.actor === "system"),
  ).toBe(true);
  expect(agent.some((event) => event.category === "funding")).toBe(false);
  expect(activityFor("empty", "none", [])).toEqual([]);
});

for (const [width, height] of [
  [375, 900],
  [768, 900],
  [1280, 720],
  [1440, 900],
]) {
  test(`Agents is accessible and fits ${width}×${height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.goto("/demo?view=agents");
    await expect(
      page.getByRole("heading", { name: "Agents", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Agents", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("agent-detail")).toContainText(
      "92 of 100 remaining",
    );
    await expect(
      page.getByRole("searchbox", { name: "Search agents" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Per-order limits" }),
    ).toContainText("200 lots");
    await expect(
      page.getByRole("button", { name: /Revoke agent/ }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations).toEqual([]);
    if (width === 1440 || width === 375)
      await page.screenshot({
        path: testInfo.outputPath("agents.png"),
        fullPage: true,
      });
  });
}

test("directory shows scoped permissions and historical expired allowance", async ({
  page,
}) => {
  await page.goto("/demo?view=agents");
  const detail = page.getByTestId("agent-detail");
  await expect(detail).toContainText("READ is account-wide");
  await expect(detail).toContainText("not yours or another agent’s");
  await detail.getByText("Agent public key", { exact: true }).click();
  await expect(detail.locator("code")).toHaveText(sampleAgents[0].publicKey);
  await page.getByRole("button", { name: "Inspect BTC hedger" }).click();
  await expect(page).toHaveURL(/agent=btc-hedger/);
  await expect(detail).toContainText("Historical allowance · Grant inactive");
  await expect(detail).toContainText("It no longer authorizes new requests");
  await expect(detail.locator(".d-agent-scope")).not.toContainText("READ");
  await page.reload();
  await expect(
    detail.getByRole("heading", { name: "BTC hedger" }),
  ).toBeVisible();
  await page.getByText("Revoking agent access", { exact: true }).click();
  await expect(page.locator(".d-agent-revocation")).toContainText(
    "all existing agent grants",
  );
  await expect(page.locator(".d-agent-revocation")).toContainText(
    "It does not cancel outstanding orders",
  );
});

test("View all activity opens the shared ledger filtered to the agent", async ({
  page,
}) => {
  await page.goto("/demo?view=agents&filter=funding&actor=system");
  await page.getByRole("button", { name: "View all activity" }).click();
  await expect(page).toHaveURL(/view=activity/);
  await expect(page).toHaveURL(/actor=sol-execution/);
  await expect(page.getByLabel("Initiated by")).toHaveValue("sol-execution");
  await expect(
    page.getByRole("button", { name: "All activity", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator(
      '.d-events [data-event-id="FU-302"], .d-events [data-actor="you"], .d-events [data-actor="btc-hedger"]',
    ),
  ).toHaveCount(0);
  // Illustrative grant actions are not mixed into the paper account ledger.
  await expect(page.locator(".d-events > li")).toHaveCount(0);
  await page.getByRole("button", { name: "Fees", exact: true }).click();
  await expect(page.locator(".d-events > li")).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Initiated by")).toHaveValue("sol-execution");
  await expect(page.locator(".d-events > li")).toHaveCount(0);
  await page.getByRole("button", { name: "Funding", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No activity in this view" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear actor filter" }).click();
  await expect(page.locator(".d-events > li")).toHaveCount(0);
});

test("actor filters compose and agent request details never fabricate orders", async ({
  page,
}) => {
  await page.goto("/demo?view=activity&actor=sol-execution&filter=orders");
  await expect(page.getByLabel("Initiated by")).toHaveValue("sol-execution");
  await expect(page.locator(".d-events li")).toHaveCount(0);
  await page.getByLabel("Initiated by").selectOption("you");
  await expect(page.locator(".d-events li")).toHaveCount(0);
  await page.getByLabel("Initiated by").selectOption("system");
  await expect(page.locator(".d-events li")).toHaveCount(0);
  await page.goto("/demo?view=activity&actor=unknown");
  await expect(page.getByLabel("Initiated by")).toHaveValue("all");
});

test("onboarding validates, reviews without authorizing, and restores focus", async ({
  page,
}, testInfo) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      ["POST", "PUT", "DELETE", "PATCH"].includes(request.method()) &&
      !request.url().includes("localhost")
    )
      writes.push(request.url());
  });
  await page.goto("/demo?view=agents");
  const add = page.getByRole("button", { name: "Add agent", exact: true });
  await add.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(
    "No signing, permissions granted or keys stored",
  );
  await expect(
    dialog.getByRole("checkbox", { name: /Read account/ }),
  ).not.toBeChecked();
  await dialog
    .getByRole("button", { name: "Review authorization preview" })
    .click();
  await expect(dialog.getByLabel("Agent name", { exact: true })).toBeFocused();
  await dialog.getByLabel("Agent name", { exact: true }).fill("My bot");
  await dialog
    .getByLabel("Agent public key", { exact: true })
    .fill("secret seed phrase words");
  await dialog
    .getByRole("button", { name: "Review authorization preview" })
    .click();
  await expect(
    dialog.getByLabel("Agent public key", { exact: true }),
  ).toBeFocused();
  await expect(dialog).toContainText("Never paste a secret key");
  await dialog
    .getByLabel("Agent public key", { exact: true })
    .fill(sampleAgents[0].publicKey);
  await dialog
    .getByLabel("Trading market", { exact: true })
    .selectOption("BTC");
  await dialog.getByRole("checkbox", { name: /Read account/ }).check();
  await expect(dialog).toContainText("READ exposes your whole account");
  await dialog.getByLabel("Maximum lots per order", { exact: true }).fill("0");
  await dialog
    .getByRole("button", { name: "Review authorization preview" })
    .click();
  await expect(
    dialog.getByLabel("Maximum lots per order", { exact: true }),
  ).toBeFocused();
  await dialog.getByLabel("Maximum lots per order", { exact: true }).fill("50");
  await dialog
    .getByRole("button", { name: "Review authorization preview" })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Review My bot" }),
  ).toBeFocused();
  await expect(dialog).toContainText("across all markets, not just BTC");
  await expect(dialog).toContainText(
    "This preview does not authorize an agent",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("authorization-preview.png"),
  });
  await dialog.getByRole("button", { name: "Edit preview" }).click();
  await expect(
    dialog.getByLabel("Maximum lots per order", { exact: true }),
  ).toHaveValue("50");
  await page.keyboard.press("Escape");
  await expect(add).toBeFocused();
  await expect(page.locator(".d-agent-row")).toHaveCount(2);
  expect(page.url()).not.toContain(sampleAgents[0].publicKey);
  expect(writes).toEqual([]);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => /agent|grant/i.test(key)),
    ),
  ).toEqual([]);
});

test("mobile onboarding is scrollable and keeps controls inside the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/demo?view=agents");
  await page.getByRole("button", { name: "Add agent", exact: true }).click();
  const dialog = page.getByRole("dialog");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByLabel("Agent name", { exact: true }).fill("Bot");
  await dialog
    .getByLabel("Agent public key", { exact: true })
    .fill(sampleAgents[0].publicKey);
  await dialog
    .getByRole("button", { name: "Review authorization preview" })
    .click();
  await dialog
    .getByRole("button", { name: "Close preview" })
    .scrollIntoViewIfNeeded();
  await expect(
    dialog.getByRole("button", { name: "Close preview" }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await dialog.getByRole("button", { name: "Close preview" }).click();
  await expect(dialog).toHaveCount(0);
});

test("switching from a scrolled Agents page opens Activity at its filters", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/demo?view=agents");
  // Initial hydration mounts the keyed content and can reset a premature scroll.
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true }),
  ).toBeEnabled();
  await page.getByText("Revoking agent access", { exact: true }).click();
  await page.getByText("Agent public key", { exact: true }).click();
  await page.locator(".d-account-content").evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  expect(
    await page.locator(".d-account-content").evaluate((node) => node.scrollTop),
  ).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page.getByLabel("Initiated by")).toBeInViewport();
  expect(
    await page.locator(".d-account-content").evaluate((node) => node.scrollTop),
  ).toBe(0);
});

test("agent search and status filters compose without silently changing the selection", async ({
  page,
}) => {
  await page.goto("/demo?view=agents&agent=sol-execution");
  const directory = page.getByRole("region", { name: "Agent directory" });
  const search = directory.getByRole("searchbox", { name: "Search agents" });
  const filters = directory.getByRole("group", { name: "Agent status filter" });
  const detail = page.getByTestId("agent-detail");
  await search.fill("  sOL  ");
  await expect(directory.locator(".d-agent-row")).toHaveCount(1);
  await expect(
    directory.getByRole("button", { name: "Inspect SOL execution" }),
  ).toBeVisible();
  await expect(directory.locator(".d-agent-result-count")).toHaveText(
    "1 of 2 agents",
  );
  await filters.getByRole("button", { name: /^Expired/ }).click();
  await expect(
    directory.getByRole("heading", { name: "No matching agents" }),
  ).toBeVisible();
  await expect(
    detail.getByRole("heading", { name: "SOL execution", exact: true }),
  ).toBeVisible();
  await expect(detail.locator(".d-agent-filter-notice")).toContainText(
    "Selected agent is hidden",
  );
  await expect(page).toHaveURL(/agent=sol-execution/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await directory
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("");
  await expect(filters.getByRole("button", { name: /^All/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(directory.locator(".d-agent-row")).toHaveCount(2);
  await expect(detail.locator(".d-agent-filter-notice")).toHaveCount(0);

  await filters.getByRole("button", { name: /^Expired/ }).click();
  await directory.getByRole("button", { name: "Inspect BTC hedger" }).click();
  await expect(page).toHaveURL(/agent=btc-hedger/);
  await expect(
    detail.getByRole("heading", { name: "BTC hedger", exact: true }),
  ).toBeVisible();
  await expect(detail.locator(".d-agent-filter-notice")).toHaveCount(0);
  await filters.getByRole("button", { name: /^Authorized/ }).click();
  await detail.getByRole("button", { name: "Clear filters" }).click();
  await expect(
    directory.getByRole("button", { name: "Inspect BTC hedger" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("agent search finds markets and public keys, clears by keyboard, and does not persist key queries", async ({
  page,
}) => {
  await page.goto("/demo?view=agents");
  const search = page.getByRole("searchbox", { name: "Search agents" });
  await search.fill("btc hedger");
  await expect(page.locator(".d-agent-row")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Inspect BTC hedger" }),
  ).toBeVisible();
  await search.fill(sampleAgents[0].publicKey.slice(0, 12));
  await expect(page.locator(".d-agent-row")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Inspect SOL execution" }),
  ).toBeVisible();
  expect(page.url()).not.toContain(sampleAgents[0].publicKey.slice(0, 12));
  await search.press("Escape");
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("");
  await expect(page.locator(".d-agent-row")).toHaveCount(2);
  await search.fill("SOL-PERP");
  await page.getByRole("button", { name: "Clear agent search" }).click();
  await expect(search).toBeFocused();
  await expect(page.locator(".d-agent-row")).toHaveCount(2);
});

test("mobile agent selection brings compact details into view and supports returning to search", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/demo?view=agents");
  await page.getByRole("button", { name: "Inspect BTC hedger" }).click();
  const heading = page
    .getByTestId("agent-detail")
    .getByRole("heading", { name: "BTC hedger", exact: true });
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
  await expect(page).toHaveURL(/agent=btc-hedger/);
  await expect(
    page.getByRole("button", { name: "Back to directory" }),
  ).toBeInViewport();
  await page.getByRole("button", { name: "Back to directory" }).click();
  await expect(
    page.getByRole("searchbox", { name: "Search agents" }),
  ).toBeFocused();
  await expect(
    page.getByRole("searchbox", { name: "Search agents" }),
  ).toBeInViewport();
  await page.getByRole("searchbox", { name: "Search agents" }).fill("sol");
  await expect(
    page.getByTestId("agent-detail").locator(".d-agent-filter-notice"),
  ).toBeVisible();
  await page
    .getByTestId("agent-detail")
    .getByRole("button", { name: "Clear filters" })
    .click();
  await expect(
    page.getByRole("searchbox", { name: "Search agents" }),
  ).toBeFocused();
  await expect(
    page.getByRole("searchbox", { name: "Search agents" }),
  ).toBeInViewport();
});

test("empty and stale accounts retain truthful agent states", async ({
  page,
}) => {
  await page.goto("/demo?view=agents&scenario=empty");
  await expect(
    page.getByRole("heading", { name: "No agents authorized" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add agent", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".d-agent-row")).toHaveCount(0);
  await page.goto("/demo?view=agents&scenario=stale");
  await expect(page.locator(".d-agents-summary")).toContainText(
    "Sample authorizations",
  );
  await expect(page.locator(".d-agent-row")).toHaveCount(2);
});

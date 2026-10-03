import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockMarketData } from "./helpers/market-data";
import { chooseVenue } from "./helpers/venue-select";

declare global {
  interface Window {
    cinderWalletTest: {
      calls: string[];
      reject: boolean;
      change: (address?: string) => void;
      unregister: () => void;
      resolve: () => void;
    };
  }
}

async function mockWallet(
  page: import("@playwright/test").Page,
  options: { reject?: boolean; deferred?: boolean } = {},
) {
  await page.addInitScript(({ reject, deferred }) => {
    const first = "11111111111111111111111111111111";
    const listeners = new Set<(value: unknown) => void>();
    let accounts: {
      address: string;
      publicKey: Uint8Array;
      chains: string[];
      features: string[];
    }[] = [];
    let unregister = () => {};
    let resolve = () => {};
    const state = {
      calls: [] as string[],
      reject: !!reject,
      change(address?: string) {
        accounts = address
          ? [
              {
                address,
                publicKey: new Uint8Array(32),
                chains: ["solana:mainnet"],
                features: [],
              },
            ]
          : [];
        listeners.forEach((fn) => fn({ accounts }));
      },
      unregister: () => unregister(),
      resolve: () => resolve(),
    };
    window.cinderWalletTest = state;
    const wallet = {
      version: "1.0.0",
      name: "Test Solana Wallet",
      icon:
        "data:image/svg+xml;base64," +
        btoa(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#0051fe"/></svg>',
        ),
      chains: ["solana:mainnet"],
      get accounts() {
        return accounts;
      },
      features: {
        "standard:connect": {
          version: "1.0.0",
          async connect() {
            state.calls.push("connect");
            if (deferred)
              await new Promise<void>((done) => {
                resolve = done;
              });
            if (state.reject) throw new Error("Rejected");
            state.change(first);
            return { accounts };
          },
        },
        "standard:events": {
          version: "1.0.0",
          on(_event: string, fn: (value: unknown) => void) {
            listeners.add(fn);
            return () => {
              listeners.delete(fn);
            };
          },
        },
        "standard:disconnect": {
          version: "1.0.0",
          async disconnect() {
            state.calls.push("disconnect");
            state.change();
          },
        },
        "solana:signMessage": {
          signMessage() {
            state.calls.push("SIGN MESSAGE");
            throw new Error("Signing must not be called");
          },
        },
        "solana:signTransaction": {
          signTransaction() {
            state.calls.push("SIGN TX");
            throw new Error("Signing must not be called");
          },
        },
        "solana:signAndSendTransaction": {
          signAndSendTransaction() {
            state.calls.push("SEND TX");
            throw new Error("Sending must not be called");
          },
        },
      },
    };
    const register = (api: { register: (wallet: unknown) => () => void }) => {
      unregister = api.register(wallet);
    };
    window.addEventListener("wallet-standard:app-ready", (event) =>
      register((event as CustomEvent).detail),
    );
    window.dispatchEvent(
      new CustomEvent("wallet-standard:register-wallet", { detail: register }),
    );
  }, options);
}

test.beforeEach(async ({ page }) => {
  await mockMarketData(page, { stream: true, phoenix: true });
});

for (const width of [375, 768, 1001, 1280, 1440]) {
  test(`clean terminal chrome and account actions fit at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/demo?venue=phoenix");
    await expect(page.locator(".d-context-strip")).toHaveCount(0);
    await expect(
      page.getByText("Trading workspace", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText(
        "Public market data · simulated account · no live trading",
        { exact: true },
      ),
    ).toHaveCount(0);
    const row = page.locator(".d-account-actions");
    const actions = [
      row.getByRole("button", {
        name: "View account balance (simulated)",
        exact: true,
      }),
      row.getByRole("button", { name: "Deposit", exact: true }),
      row.getByRole("button", { name: "Withdraw", exact: true }),
      row.getByRole("button", { name: "Connect wallet", exact: true }),
    ];
    let end = 0;
    for (const action of actions) {
      await expect(action).toBeInViewport();
      const box = (await action.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(end);
      expect(box.height).toBeGreaterThanOrEqual(40);
      end = box.x + box.width;
    }
    const heading = page.locator(".d-instrument");
    const market = heading.getByRole("combobox", {
      name: "Market",
      exact: true,
    });
    await expect(market.locator("option:checked")).toHaveText("SOL-USDC");
    await expect(heading.locator(".d-asset-icon")).toHaveAttribute(
      "src",
      "/brand/assets/sol.svg",
    );
    await expect(heading.locator(".d-venue-icon")).toHaveAttribute(
      "src",
      "/brand/venues/phoenix.svg",
    );
    await expect(heading.getByLabel("Order leverage 25x")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

for (const width of [375, 768, 1280]) {
  test(`Pro price chart keeps its independent source readable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/demo?mode=auto&panel=price");
    const source = page.getByRole("combobox", {
      name: "Chart source",
      exact: true,
    });
    await expect(source).toBeVisible();
    const instrument = (await page.locator(".d-instrument").boundingBox())!;
    const sourceBox = (await source.boundingBox())!;
    expect(
      sourceBox.y >= instrument.y + instrument.height ||
        sourceBox.x >= instrument.x + instrument.width,
    ).toBe(true);
    await chooseVenue(page, "Chart source", "phoenix");
    await expect(page.locator(".d-tv-chart")).toHaveAttribute(
      "data-chart-key",
      "SOL-phoenix-15m",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("logo selector works with mouse and keyboard without a venue-change banner", async ({
  page,
}) => {
  await page.goto("/demo");
  const selector = page.getByRole("combobox", {
    name: "Execution venue",
    exact: true,
  });
  await selector.click();
  const list = page.getByRole("listbox", {
    name: "Execution venue",
    exact: true,
  });
  for (const venue of ["pacifica", "bulk", "phoenix", "velocity"]) {
    await expect(
      list.locator(`img[src="/brand/venues/${venue}.svg"]`),
    ).toBeVisible();
    await expect
      .poll(() =>
        list
          .locator(`img[src="/brand/venues/${venue}.svg"]`)
          .evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(selector).toBeFocused();
  await selector.press("ArrowDown");
  await selector.press("p");
  await selector.press("ArrowDown");
  await selector.press("Enter");
  await expect(selector).toHaveAttribute("data-value", "bulk");
  await expect(page.getByTestId("manual-chart-source")).toHaveText("BULK");
  await expect(page.locator(".d-feedback-note")).toHaveCount(0);
  await chooseVenue(page, "Execution venue", "phoenix");
  await expect(page).toHaveURL(/venue=phoenix/);
  await expect(page.locator(".d-feedback-note")).toHaveCount(0);
  await selector.click();
  await page.getByRole("combobox", { name: "Market", exact: true }).click();
  await expect(list).toHaveCount(0);
});

test("wallet picker has an honest empty state and returns focus on Escape", async ({
  page,
}) => {
  await page.goto("/demo");
  const button = page.getByRole("button", {
    name: "Connect wallet",
    exact: true,
  });
  await button.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("No Solana wallet detected");
  await expect(dialog).toContainText("Connection only. No signatures");
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await expect(
    dialog.getByRole("link", { name: "Get Phantom" }),
  ).toHaveAttribute("href", "https://phantom.com/");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(button).toBeFocused();
});

test("wallet connection never signs, sends or changes simulated account funds", async ({
  page,
}) => {
  await mockWallet(page);
  await page.goto("/demo");
  expect(await page.evaluate(() => window.cinderWalletTest.calls)).toEqual([]);
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Test Solana Wallet", exact: true })
    .click();
  const connected = page.getByRole("button", {
    name: "Wallet 1111…1111",
    exact: true,
  });
  await expect(connected).toHaveAttribute("data-connected", "true");
  await expect(page.locator(".d-header-balance")).toContainText("12,024.00");
  expect(await page.evaluate(() => window.cinderWalletTest.calls)).toEqual([
    "connect",
  ]);
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(connected).toBeVisible();
  await connected.click();
  await expect(page.getByRole("dialog")).toContainText(
    "11111111111111111111111111111111",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.cinderWalletTest.calls)).toEqual([
    "connect",
    "disconnect",
  ]);
  await page.reload();
  expect(await page.evaluate(() => window.cinderWalletTest.calls)).toEqual([]);
});

test("rejected connection can be retried", async ({ page }) => {
  await mockWallet(page, { reject: true });
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Test Solana Wallet", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Connection wasn't completed",
  );
  await page.evaluate(() => {
    window.cinderWalletTest.reject = false;
  });
  await page
    .getByRole("button", { name: "Test Solana Wallet", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Wallet 1111…1111", exact: true }),
  ).toBeVisible();
});

test("wallet account changes and external disconnect update the header", async ({
  page,
}) => {
  await mockWallet(page);
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Test Solana Wallet", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Wallet 1111…1111", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.cinderWalletTest.change(
      "So11111111111111111111111111111111111111112",
    ),
  );
  await expect(
    page.getByRole("button", { name: "Wallet So11…1112", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.cinderWalletTest.change());
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true }),
  ).toBeVisible();
});

test("unregistered wallet cannot leave a stale connected badge", async ({
  page,
}) => {
  await mockWallet(page);
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Test Solana Wallet", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Wallet 1111…1111", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.cinderWalletTest.unregister());
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true }),
  ).toBeVisible();
});

test("closing a pending connection ignores its late response", async ({
  page,
}) => {
  await mockWallet(page, { deferred: true });
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Test Solana Wallet", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText(
    "Approve in wallet…",
  );
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.cinderWalletTest.resolve());
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true }),
  ).toHaveAttribute("data-connected", "false");
});

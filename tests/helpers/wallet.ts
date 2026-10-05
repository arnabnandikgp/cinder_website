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

export async function mockWallet(
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

export async function connectWallet(page: import("@playwright/test").Page) {
  const trigger = page.getByRole("button", {
    name: "Connect wallet",
    exact: true,
  });
  if (await page.locator('.d-wallet-button[data-connected="true"]').count())
    return;
  await trigger.click();
  await page.getByRole("button", { name: "Test Solana Wallet" }).click();
  await page.locator('.d-wallet-button[data-connected="true"]').waitFor();
}

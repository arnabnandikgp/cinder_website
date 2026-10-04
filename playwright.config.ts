import { defineConfig } from "@playwright/test";
import { TOUR_SEEN_KEY } from "./src/components/demo/terminal-tour";

const baseURL = process.env.TEST_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL,
    // General terminal tests represent returning visitors. Tour tests override
    // this with a fresh browser to exercise first-visit onboarding explicitly.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: new URL(baseURL).origin,
          localStorage: [{ name: TOUR_SEEN_KEY, value: "seen" }],
        },
      ],
    },
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    trace: "retain-on-failure",
  },
});

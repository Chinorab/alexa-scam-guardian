import { defineConfig, devices } from "@playwright/test";

const PORT = 8797;
/** Set to a deployed web URL to run the suite against it instead of a local server (T102). */
const REMOTE = process.env.E2E_BASE_URL?.replace(/\/+$/, "");

/** End to end runs against a local web app (simplified mode, in memory store, demo outbox). */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: REMOTE ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 960 } },
    },
  ],
  webServer: REMOTE
    ? undefined
    : {
        command:
          "pnpm --filter @asg/web build:assets && pnpm --filter @asg/web exec tsx src/local.ts",
        url: `http://localhost:${PORT}/privacy`,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          WEB_PORT: String(PORT),
          AGENT_MODE: "simplified",
          HOUSEHOLD_TOKEN_SECRET: "e2e-household-token-secret-0123456789abcdef",
          DEMO_POLL_MS: "500",
        },
      },
});

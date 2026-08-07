import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration.
 *
 * Runs against a **production build**, not the dev server. The disclaimer gate depends
 * on a pre-paint script and on hydration behaviour that differs between the two, and
 * ADR-017 exists because a bug appeared only in a production build. Testing dev would
 * have missed it.
 *
 * `reuseExistingServer` locally, so a developer with `npm run start` already up does not
 * wait for another build; never in CI, where the run must be reproducible.
 */

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: BASE_URL,
    // Only on a failure: traces are large, and the ones from passing runs are never read.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    // A cold Next build plus start. Generous, because a timeout here reads as a test
    // failure and sends whoever hits it looking in the wrong place.
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});

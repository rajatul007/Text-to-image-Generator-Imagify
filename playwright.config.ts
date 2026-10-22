import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run the production build against a dedicated database (pixelforge_e2e) and a
 * test-only HTTP stub that stands in for the Stability AI and LLM APIs (e2e/stub-providers.mjs).
 * The app uses its real provider code paths; only the upstream base URLs point at the stub.
 *
 *   npm run build && npm run test:e2e
 */
const PORT = 3100;
const E2E_DB = process.env.E2E_DATABASE_URL ?? "postgresql://pixelforge:pixelforge@localhost:5432/pixelforge_e2e";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, grepInvert: /@mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: [
    { command: "node e2e/stub-providers.mjs", port: 4010, reuseExistingServer: true },
    {
      command: `npx next start -p ${PORT}`,
      port: PORT,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        DATABASE_URL: E2E_DB,
        APP_URL: `http://localhost:${PORT}`,
        AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-123456",
        EMAIL_PROVIDER: "console",
        STORAGE_DRIVER: "local",
        LOCAL_STORAGE_DIR: "./storage-e2e",
        JOB_RUNNER: "inline",
        STABILITY_API_KEY: "stub",
        STABILITY_API_BASE: "http://localhost:4010",
        LLM_API_KEY: "stub",
        LLM_API_BASE: "http://localhost:4010/v1",
        REDIS_URL: "",
        DISABLE_RATE_LIMIT: "1",
      },
    },
  ],
});

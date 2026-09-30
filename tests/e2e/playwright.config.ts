import { defineConfig, devices } from "@playwright/test";
import path from "path";

/**
 * E2E tests — real browser against a dedicated Next dev server on :3200 with
 * the isolated test DB (db/test.db) + deterministic seed. The app is a
 * hash-routed SPA, so navigation uses /#/… URLs.
 */
export default defineConfig({
  testDir: path.resolve(__dirname),
  globalSetup: path.resolve(__dirname, "global-setup.ts"),
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3200",
    viewport: { width: 390, height: 844 }, // iPhone-ish, the primary target
    locale: "fa-IR",
    navigationTimeout: 90_000,
    actionTimeout: 20_000,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    // desktop sanity: auth-only (data-mutating specs stay mobile-only so the
    // shared seeded DB never sees duplicate fixtures)
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      testIgnore: ["**/log-flow.spec.ts", "**/admin-users.spec.ts"],
    },
  ],
  webServer: {
    command: "node node_modules/next/dist/bin/next dev -p 3200",
    cwd: path.resolve(__dirname, "../.."),
    url: "http://localhost:3200/",
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: "file:/home/z/my-project/db/test.db",
      NEXT_DIST_DIR: ".next-test-e2e",
      SMS_PROVIDER: "",
    },
  },
});

import { defineConfig } from "vitest/config";
import path from "path";

/**
 * API (integration) tests — black-box HTTP tests against a real Next.js dev
 * server on port 3100 with an isolated SQLite test DB (db/test.db), seeded
 * deterministically by the global setup. Never touches dev data.
 */
export default defineConfig({
  test: {
    include: ["tests/api/**/*.test.ts"],
    environment: "node",
    globalSetup: [path.resolve(__dirname, "api/global-setup.ts")],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // One shared server/DB — suites must run sequentially.
    fileParallelism: false,
    pool: "forks",
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "../src") },
  },
});

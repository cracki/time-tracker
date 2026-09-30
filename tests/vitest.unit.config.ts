import { defineConfig } from "vitest/config";
import path from "path";

/** Unit tests only — pure logic, no server, no DB. */
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    testTimeout: 15_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "../src") },
  },
});

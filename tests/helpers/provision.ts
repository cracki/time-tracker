/**
 * Shared test provisioning: push the Prisma schema to the throwaway test DB
 * and seed deterministic fixtures (scripts/seed-test.ts). Used by both the
 * Vitest API global-setup and the Playwright global-setup so every suite runs
 * against an identical, known dataset — completely isolated from dev data.
 */

import { execSync, spawn, ChildProcess } from "child_process";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { seedTestDb } from "../../scripts/seed-test";

export const PROJECT_ROOT = path.resolve(__dirname, "../..");
export const TEST_DB_URL = "file:/home/z/my-project/db/test.db";
export const API_PORT = 3100;
export const API_BASE = `http://localhost:${API_PORT}`;

let pushed = false;

/** prisma db push against the test DB (cheap after the first run). */
export function pushTestSchema(): void {
  if (pushed) return;
  execSync("bunx prisma db push --skip-generate", {
    cwd: PROJECT_ROOT,
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "pipe",
  });
  pushed = true;
}

/** Wipe + re-seed the test DB. */
export async function resetTestDb(): Promise<void> {
  pushTestSchema();
  const db = new PrismaClient({ datasourceUrl: TEST_DB_URL });
  try {
    await seedTestDb(db);
  } finally {
    await db.$disconnect();
  }
}

let server: ChildProcess | null = null;

/** Spawn `next dev` on API_PORT with the test DATABASE_URL; wait until ready. */
export async function startTestServer(): Promise<void> {
  if (server) return;
  // Kill anything squatting on the port from a crashed previous run.
  try {
    execSync("pkill -f 'next dev -p 3100' || true", { stdio: "pipe" });
    await new Promise((r) => setTimeout(r, 1500));
  } catch { /* port already free */ }

  server = spawn(
    process.execPath,
    [path.join(PROJECT_ROOT, "node_modules/next/dist/bin/next"), "dev", "-p", String(API_PORT)],
    {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        DATABASE_URL: TEST_DB_URL,
        // separate build dir — the dev server holds .next/dev/lock
        NEXT_DIST_DIR: ".next-test",
        // tests run with SMS disabled → devCode returned
        SMS_PROVIDER: "",
      },
      stdio: "pipe",
    },
  );
  server.stdout?.on("data", (d: Buffer) => process.env.TEST_VERBOSE && process.stdout.write(`[api-test] ${d}`));
  server.stderr?.on("data", (d: Buffer) => process.stderr.write(`[api-test:err] ${d}`));

  await waitFor(`${API_BASE}/`, 120_000);
}

export async function waitFor(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok || res.status === 404) return; // app shell answers
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Test server did not become ready at ${url}: ${lastErr}`);
}

export function stopTestServer(): void {
  server?.kill("SIGTERM");
  server = null;
  // belt & braces: never leave an orphan test server behind
  try {
    execSync("pkill -f 'next dev -p 3100' || true", { stdio: "pipe" });
  } catch { /* nothing to kill */ }
}

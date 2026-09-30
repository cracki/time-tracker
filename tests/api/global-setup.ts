/**
 * Vitest global setup: provision the isolated test DB + boot the Next.js dev
 * server on port 3100 that the API test suites hit over real HTTP.
 */

import { resetTestDb, startTestServer, stopTestServer, pushTestSchema } from "../helpers/provision";

export default async function setup(): Promise<() => Promise<void>> {
  pushTestSchema();
  await resetTestDb();
  await startTestServer();
  return async () => {
    stopTestServer();
  };
}

/** Playwright global setup — re-seed the isolated test DB before the suite. */

import { resetTestDb } from "../helpers/provision";

export default async function setup(): Promise<void> {
  await resetTestDb();
}

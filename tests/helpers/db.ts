/** Direct Prisma access to the TEST database — for test hygiene only
 * (e.g. clearing OTP cooldown/attempts between logins). Assertions stay
 * black-box over HTTP. */

import { PrismaClient } from "@prisma/client";
import { TEST_DB_URL } from "./provision";

const db = new PrismaClient({ datasourceUrl: TEST_DB_URL });

/** Delete the OTP session for a phone (resets cooldown + attempts). */
export async function clearOtp(phone: string): Promise<void> {
  await db.otpSession.deleteMany({ where: { phone } }).catch(() => {});
}

export async function deleteTestUserLogs(userId: string): Promise<void> {
  await db.timeLog.deleteMany({ where: { userId } });
}

export async function findUserByMobile(mobile: string): Promise<{ id: string } | null> {
  return db.user.findUnique({ where: { mobile }, select: { id: true } });
}

export default db;

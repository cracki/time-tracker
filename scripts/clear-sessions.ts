// One-off: remove raw-token session rows (pre-hashing) + expired OTPs.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const s = await db.session.deleteMany({});
const o = await db.otpSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
console.log(`sessions cleared: ${s.count}, expired otps cleared: ${o.count}`);
await db.$disconnect();

/**
 * POST /api/auth/verify-otp — step 2 of login (spec §4).
 * Verifies code (max 3 attempts, TTL 120s), creates the cookie session
 * and returns the user.
 */

import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, readJson, ServerError } from "@/lib/server/api-helpers";
import { SESSION_COOKIE, SESSION_COOKIE_OPTS, createSession, toPublicUser } from "@/lib/server/auth";
import { CONFIG, isValidMobile } from "@/lib/server/rules";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<{ phone?: string; code?: string }>(req);
    const phone = body.phone;
    const code = typeof body.code === "string" ? body.code.replace(/\D/g, "") : "";
    if (!isValidMobile(phone)) throw new ServerError("شماره موبایل معتبر نیست.", "validation");
    if (!code) throw new ServerError("کد تأیید را وارد کنید.", "validation");

    const session = await db.otpSession.findUnique({ where: { phone } });
    if (!session) throw new ServerError("ابتدا کد تأیید را دریافت کنید.", "validation");

    const now = Date.now();
    if (session.expiresAt.getTime() < now) {
      throw new ServerError("کد تأیید منقضی شده است. کد جدید بگیرید.", "validation");
    }
    if (session.attempts >= CONFIG.maxAttempts) {
      throw new ServerError("تعداد تلاش‌های نامعتبر بیش از حد مجاز است. کد جدید بگیرید.", "validation");
    }

    const codeHash = createHash("sha256").update(`${phone}:${code}`).digest("hex");
    if (session.codeHash !== codeHash) {
      const attempts = session.attempts + 1;
      await db.otpSession.update({ where: { phone }, data: { attempts } });
      const left = CONFIG.maxAttempts - attempts;
      throw new ServerError(
        left > 0 ? `کد وارد شده صحیح نیست. ${left} تلاش باقی مانده.` : "کد وارد شده صحیح نیست.",
        "validation",
      );
    }

    const user = await db.user.findUnique({ where: { mobile: phone }, include: { manager: { select: { name: true } } } });
    if (!user) throw new ServerError("کاربر یافت نشد.", "not_found");
    if (!user.isActive) throw new ServerError("حساب شما غیرفعال شده است. با مدیر تماس بگیرید.", "forbidden");

    await db.otpSession.delete({ where: { phone } }).catch(() => {});
    const { token } = await createSession(user.id);

    const res = NextResponse.json({ user: toPublicUser(user) });
    res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTS);
    return res;
  });
}

/**
 * POST /api/auth/request-otp — step 1 of login (spec §4).
 * Creates/replaces the OTP session for the phone. Delivery is env-driven:
 *   SMS_PROVIDER=kavenegar (+ KAVENEGAR_API_KEY / KAVENEGAR_OTP_TEMPLATE)
 *     → real SMS via the Kavenegar Lookup service, no devCode.
 *   otherwise
 *     → dev mode: the code is returned as devCode and surfaced in the UI.
 */

import { createHash, randomInt } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, readJson, ServerError } from "@/lib/server/api-helpers";
import { CONFIG, isValidMobile } from "@/lib/server/rules";
import { isSmsConfigured, sendOtpSms, smsProvider } from "@/lib/server/sms";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<{ phone?: string }>(req);
    const phone = body.phone;
    if (!isValidMobile(phone)) {
      throw new ServerError("شماره موبایل معتبر نیست.", "validation");
    }
    const user = await db.user.findUnique({ where: { mobile: phone } });
    if (!user) throw new ServerError("کاربری با این شماره ثبت نشده است.", "not_found");
    if (!user.isActive) throw new ServerError("حساب شما غیرفعال شده است. با مدیر تماس بگیرید.", "forbidden");

    const now = new Date();
    const existing = await db.otpSession.findUnique({ where: { phone } });
    if (existing && existing.cooldownUntil && existing.cooldownUntil.getTime() > now.getTime()) {
      const sec = Math.ceil((existing.cooldownUntil.getTime() - now.getTime()) / 1000);
      throw new ServerError(`برای دریافت مجدد کد ${sec} ثانیه صبر کنید.`, "validation");
    }

    const code = String(randomInt(10000, 100000));
    const codeHash = createHash("sha256").update(`${phone}:${code}`).digest("hex");
    const expiresAt = new Date(now.getTime() + CONFIG.otpTtlSec * 1000);
    const cooldownUntil = new Date(now.getTime() + CONFIG.resendCooldownSec * 1000);

    await db.otpSession.upsert({
      where: { phone },
      create: { phone, codeHash, expiresAt, attempts: 0, cooldownUntil },
      update: { codeHash, expiresAt, attempts: 0, cooldownUntil },
    });

    // Opportunistic hygiene: drop expired OTP sessions.
    await db.otpSession.deleteMany({ where: { expiresAt: { lt: now } } }).catch(() => {});

    if (isSmsConfigured()) {
      try {
        await sendOtpSms(phone, code);
      } catch (e) {
        // Do not leave a session that can never be verified — force a clean retry.
        await db.otpSession.delete({ where: { phone } }).catch(() => {});
        console.error("[sms] OTP delivery failed:", e);
        throw new ServerError(
          `ارسال پیامک تأیید ناموفق بود. ${(e as Error).message}`.trim(),
          "sms_failed",
        );
      }
      return NextResponse.json({ expiresAt: expiresAt.getTime() });
    }

    if (process.env.NODE_ENV === "production" && smsProvider() === "kavenegar") {
      // Provider selected but misconfigured — never leak codes in production.
      console.error("[sms] KAVENEGAR_* env incomplete; OTP not sent.");
      throw new ServerError("سرویس پیامک پیکربندی نشده است. با مدیر تماس بگیرید.", "sms_failed");
    }

    return NextResponse.json({
      devCode: code, // dev mode — surfaces the code in the UI until SMS is connected
      expiresAt: expiresAt.getTime(),
    });
  });
}

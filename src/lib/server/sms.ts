/**
 * SMS provider adapter — Kavenegar (kavenegar.com/rest.html).
 *
 * OTP delivery uses the **Lookup (Verify)** service:
 *   GET https://api.kavenegar.com/v1/{API-KEY}/verify/lookup.json
 *       ?receptor=09xxxxxxxxx&token={code}&template={TEMPLATE}
 *
 * Configuration (all via environment variables — no code changes needed):
 *   SMS_PROVIDER            "kavenegar" to enable real SMS; anything else = dev mode
 *   KAVENEGAR_API_KEY       API key from the Kavenegar panel (Account → API Key)
 *   KAVENEGAR_SENDER        خط سرویس (service number) — provided by the operator.
 *                           The Lookup/verify service delivers from Kavenegar's
 *                           dedicated service line and does not take a sender;
 *                           this value is required for the direct sms/send path
 *                           (sendSms) and is validated/used there.
 *   KAVENEGAR_OTP_TEMPLATE  Template name registered in the Kavenegar panel
 *                           (e.g. "time-track-otp" with a %token placeholder).
 *
 * Dev mode (provider != kavenegar): the OTP code is returned to the client as
 * devCode and surfaced in the UI — the hint box hides itself automatically
 * once real SMS is enabled.
 */

const KAVENEGAR_BASE = "https://api.kavenegar.com/v1";
const SMS_TIMEOUT_MS = 10_000;

export type SmsProvider = "none" | "kavenegar";

export function smsProvider(): SmsProvider {
  return process.env.SMS_PROVIDER === "kavenegar" ? "kavenegar" : "none";
}

export function isSmsConfigured(): boolean {
  if (smsProvider() !== "kavenegar") return false;
  return Boolean(process.env.KAVENEGAR_API_KEY && process.env.KAVENEGAR_OTP_TEMPLATE);
}

class SmsError extends Error {
  constructor(
    message: string,
    readonly kavenegarStatus?: number,
  ) {
    super(message);
    this.name = "SmsError";
  }
}

interface KavenegarReturn {
  status: number;
  message: string;
}

interface KavenegarResponse {
  return?: KavenegarReturn;
  entries?: unknown;
}

/** Normalize local mobile formats for Kavenegar receptors (09… / +98… / 98…). */
function normalizeReceptor(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (digits.startsWith("98")) return `0${digits.slice(2)}`;
  if (digits.startsWith("9") && digits.length === 10) return `0${digits}`;
  return digits;
}

async function callKavenegar(path: string, params: Record<string, string>): Promise<KavenegarResponse> {
  const apiKey = process.env.KAVENEGAR_API_KEY;
  if (!apiKey) throw new SmsError("کلید API کاوه‌نگار تنظیم نشده است (KAVENEGAR_API_KEY).");

  const url = new URL(`${KAVENEGAR_BASE}/${encodeURIComponent(apiKey)}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, v);
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), SMS_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET", // Kavenegar accepts GET & POST for verify/lookup.json
      cache: "no-store",
      signal: ac.signal,
    });
    const body = (await res.json().catch(() => null)) as KavenegarResponse | null;
    const status = body?.return?.status ?? res.status;
    // Kavenegar signals success via return.status === 200 (HTTP is 200/4xx/5xx accordingly)
    if (status !== 200) {
      const msg = body?.return?.message ?? `HTTP ${res.status}`;
      throw new SmsError(`خطای کاوه‌نگار (${status}): ${msg}`, status);
    }
    return body ?? {};
  } catch (e) {
    if (e instanceof SmsError) throw e;
    if ((e as Error).name === "AbortError") {
      throw new SmsError("پاسخ کاوه‌نگار بیش از حد طول کشید (timeout).");
    }
    throw new SmsError(`اتصال به کاوه‌نگار برقرار نشد: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send the OTP code via Kavenegar **Lookup** service (sms-Lookup in the REST docs).
 * The template must exist in the Kavenegar panel with a `%token` placeholder.
 */
export async function sendOtpSms(mobile: string, code: string): Promise<void> {
  const template = process.env.KAVENEGAR_OTP_TEMPLATE;
  if (!template) {
    throw new SmsError("نام قالب کاوه‌نگار تنظیم نشده است (KAVENEGAR_OTP_TEMPLATE).");
  }
  await callKavenegar("/verify/lookup.json", {
    receptor: normalizeReceptor(mobile),
    token: code,
    template,
  });
}

/**
 * Direct SMS send (Kavenegar sms/send) — reserved for non-OTP notifications.
 * This is the path where the operator's service line (KAVENEGAR_SENDER) is used.
 */
export async function sendSms(mobiles: string[], message: string): Promise<void> {
  const sender = process.env.KAVENEGAR_SENDER;
  if (!sender) {
    throw new SmsError("شماره خط سرویس تنظیم نشده است (KAVENEGAR_SENDER).");
  }
  await callKavenegar("/sms/send.json", {
    receptor: mobiles.map(normalizeReceptor).join(","),
    message,
    sender,
  });
}

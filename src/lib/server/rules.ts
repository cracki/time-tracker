/**
 * Business rules — server-side mirror of the mock API logic (spec §17/§20/§55).
 * All calendar-date math uses Tehran local dates (users are in Iran) as
 * yyyy-mm-dd ISO strings, so client and server agree on "today".
 */

import { addDays } from "../jalali";
import { ServerError } from "./api-helpers";

export const CONFIG = {
  backdateLimitDays: 3,
  otpLength: 5,
  otpTtlSec: 120,
  resendCooldownSec: 30,
  maxAttempts: 3,
  sessionTtlDays: 30,
};

/** Today in Asia/Tehran as yyyy-mm-dd (client dates are Tehran-local too). */
export function tehranTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(new Date());
}

/** Date N days before Tehran-today as yyyy-mm-dd (pure UTC math — TZ-independent). */
export function tehranDaysAgoIso(days: number): string {
  const [y, m, d] = tehranTodayIso().split("-").map(Number);
  return isoOfUtc(addDays(new Date(Date.UTC(y, m - 1, d)), -days));
}

function isoOfUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse + validate an yyyy-mm-dd work date. */
export function parseWorkDate(v: unknown, field = "تاریخ"): string {
  if (typeof v !== "string" || !ISO_RE.test(v)) {
    throw new ServerError(`${field} نامعتبر است.`, "validation");
  }
  return v;
}

/** Backdate window rule (spec §17): [today − backdateLimitDays … today] */
export function assertWorkDateInRange(workDate: string, field = "تاریخ") {
  const today = tehranTodayIso();
  const min = tehranDaysAgoIso(CONFIG.backdateLimitDays);
  if (workDate > today) throw new ServerError("ثبت زمان برای آینده مجاز نیست.", "validation");
  if (workDate < min) {
    throw new ServerError(`حداکثر ${CONFIG.backdateLimitDays} روز قبل قابل ثبت است.`, "validation");
  }
  void field;
}

/** Weekend uses Jalali week order (0=شنبه). Date-only values are TZ-safe at UTC midnight. */
export function jalaliWeekday(isoDateStr: string): number {
  const [y, m, d] = isoDateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (date.getUTCDay() + 1) % 7;
}

/**
 * Outside-hours classification (spec §27):
 * holiday (official) > weekend (non-working day) > outside (working day, kept for future
 * time-window checks) > normal.
 */
export function computeOutsideKind(
  workDate: string,
  workingDays: number[],
  holidayDates: Set<string>,
): "normal" | "outside" | "weekend" | "holiday" {
  if (holidayDates.has(workDate)) return "holiday";
  if (!workingDays.includes(jalaliWeekday(workDate))) return "weekend";
  return "normal";
}

export function isValidMobile(v: unknown): v is string {
  return typeof v === "string" && /^09\d{9}$/.test(v);
}

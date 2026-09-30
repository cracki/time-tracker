/**
 * Jalali (Persian) calendar utilities — spec §16/§86.
 * Standard jalaali algorithm (accurate 1178–3177 AP), local timezone only.
 * Business logic uses ISO gregorian dates; this layer is presentation/calendar.
 */
import { toPersianDigits } from "./format";

export const J_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

/** Jalali weekday index: 0=شنبه … 6=جمعه */
export const J_WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
export const J_WEEKDAYS_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

/* ── Core algorithm ─────────────────────────────────────────── */

function div(a: number, b: number) { return ~~(a / b); }
function mod(a: number, b: number) { return a - ~~(a / b) * b; }

const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

function jalCal(jy: number) {
  const bl = BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jump = 0;
  for (let i = 1; i < bl; i += 1) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
    + div(153 * mod(gm + 9, 12) + 2, 5)
    + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy: number, jm: number, jd: number) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn: number) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      const jm = 1 + div(k, 31);
      const jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  const jm = 7 + div(k, 30);
  const jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

export function isLeapJalaliYear(jy: number) {
  return jalCal(jy).leap === 0;
}

export function jalaliMonthLength(jy: number, jm: number) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaliYear(jy) ? 30 : 29;
}

export function toJalali(gy: number, gm: number, gd: number) {
  return d2j(g2d(gy, gm, gd));
}

export function toGregorian(jy: number, jm: number, jd: number) {
  return d2g(j2d(jy, jm, jd));
}

/* ── Date-object helpers (local timezone) ───────────────────── */

export interface JDate { jy: number; jm: number; jd: number; }

export function dateToJalali(date: Date): JDate {
  return toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function jalaliToDate(jy: number, jm: number, jd: number): Date {
  const g = toGregorian(jy, jm, jd);
  return new Date(g.gy, g.gm - 1, g.gd);
}

export function jWeekdayIndex(date: Date): number {
  // JS: 0=Sunday … 6=Saturday  →  Jalali: 0=شنبه … 6=جمعه
  return (date.getDay() + 1) % 7;
}

export function isWeekend(date: Date): boolean {
  const w = jWeekdayIndex(date);
  return w === 5 || w === 6; // پنجشنبه / جمعه
}

export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function diffDays(a: Date, b: Date): number {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.round(ms / 86400000);
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function today(): Date {
  return startOfDay(new Date());
}

/* ── Formatting ─────────────────────────────────────────────── */

export type JalaliFormatStyle = "short" | "medium" | "long" | "full" | "weekdayLong";

export function formatJalali(input: Date | string, style: JalaliFormatStyle = "short"): string {
  const date = typeof input === "string" ? parseIso(input) : input;
  const { jy, jm, jd } = dateToJalali(date);
  switch (style) {
    case "short":
      return toPersianDigits(`${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`);
    case "medium":
      return `${toPersianDigits(jd)} ${J_MONTHS[jm - 1]}`;
    case "long":
      return `${toPersianDigits(jd)} ${J_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
    case "full":
      return `${J_WEEKDAYS[jWeekdayIndex(date)]}، ${toPersianDigits(jd)} ${J_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
    case "weekdayLong":
      return `${J_WEEKDAYS[jWeekdayIndex(date)]} ${toPersianDigits(jd)} ${J_MONTHS[jm - 1]}`;
  }
}

/** «امروز» / «دیروز» / «پریروز» / weekday+date within year */
export function relativeDayLabel(input: Date | string): string {
  const date = typeof input === "string" ? parseIso(input) : input;
  const d = diffDays(date, today());
  if (d === 0) return "امروز";
  if (d === -1) return "دیروز";
  if (d === -2) return "پریروز";
  if (d === 1) return "فردا";
  const { jy, jm } = dateToJalali(date);
  const { jy: ty } = dateToJalali(today());
  if (jy === ty) return formatJalali(date, "weekdayLong");
  return formatJalali(date, "long");
}

/* ── Range math (spec §16 presets) ──────────────────────────── */

export function startOfJWeek(date: Date): Date {
  const w = jWeekdayIndex(date);
  return addDays(startOfDay(date), -w);
}

export function endOfJWeek(date: Date): Date {
  return addDays(startOfJWeek(date), 6);
}

export function startOfJMonth(date: Date): Date {
  const { jy, jm } = dateToJalali(date);
  return jalaliToDate(jy, jm, 1);
}

export function endOfJMonth(date: Date): Date {
  const { jy, jm } = dateToJalali(date);
  return jalaliToDate(jy, jm, jalaliMonthLength(jy, jm));
}

export function addJMonths(date: Date, n: number): Date {
  const { jy, jm, jd } = dateToJalali(date);
  let ny = jy + Math.floor((jm - 1 + n) / 12);
  let nm = (((jm - 1 + n) % 12) + 12) % 12 + 1;
  const maxD = jalaliMonthLength(ny, nm);
  return jalaliToDate(ny, nm, Math.min(jd, maxD));
}

export interface DateRange { from: Date; to: Date; label: string; }

export function presetRange(preset: string, now: Date = today()): DateRange | null {
  switch (preset) {
    case "today": return { from: now, to: now, label: "امروز" };
    case "yesterday": { const y = addDays(now, -1); return { from: y, to: y, label: "دیروز" }; }
    case "thisWeek": return { from: startOfJWeek(now), to: now, label: "این هفته" };
    case "lastWeek": { const s = startOfJWeek(addDays(now, -7)); return { from: s, to: addDays(s, 6), label: "هفته قبل" }; }
    case "thisMonth": return { from: startOfJMonth(now), to: now, label: "این ماه" };
    case "lastMonth": { const s = startOfJMonth(addDays(now, -1)); return { from: s, to: endOfJMonth(addDays(now, -1)), label: "ماه قبل" }; }
    default: return null;
  }
}

export const RANGE_PRESETS: { key: string; label: string }[] = [
  { key: "today", label: "امروز" },
  { key: "yesterday", label: "دیروز" },
  { key: "thisWeek", label: "این هفته" },
  { key: "lastWeek", label: "هفته قبل" },
  { key: "thisMonth", label: "این ماه" },
  { key: "lastMonth", label: "ماه قبل" },
  { key: "custom", label: "بازه دلخواه" },
];

/** Each day between from..to inclusive */
export function eachDay(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  let cur = startOfDay(from);
  const end = startOfDay(to);
  while (cur.getTime() <= end.getTime()) {
    out.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return out;
}

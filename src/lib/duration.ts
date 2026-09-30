/** Duration helpers — stored as minutes (spec §9), displayed as HH:MM. */
import { toPersianDigits, toLatinDigits } from "./format";

export function minutesToHHMM(min: number, persian = true): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const s = `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  return persian ? toPersianDigits(s) : s;
}

/** "02:30" → 150 ; tolerant of "2:30", "۲:۳۰", "230" */
export function hhmmToMinutes(raw: string): number | null {
  const s = toLatinDigits(raw).trim();
  if (!s) return null;
  let h = 0;
  let m = 0;
  if (s.includes(":")) {
    const parts = s.split(":");
    if (parts.length > 2) return null;
    const hh = parts[0] || "0";
    const mm = parts[1] || "0";
    if (!/^\d{1,2}$/.test(hh) || !/^\d{1,2}$/.test(mm)) return null;
    h = Number(hh);
    m = Number(mm);
  } else if (/^\d{1,4}$/.test(s)) {
    if (s.length <= 2) {
      h = Number(s);
      m = 0;
    } else {
      h = Number(s.slice(0, -2));
      m = Number(s.slice(-2));
    }
  } else {
    return null;
  }
  if (m > 59 || h > 23) return null;
  return h * 60 + m;
}

/** Mask digits string ("230" → "۲:۳۰" style HH:MM progressive display) */
export function maskDigitsToHHMM(digits: string, persian = true): string {
  const d = digits;
  let hh = "0";
  let mm = "";
  if (d.length <= 2) {
    hh = d.length ? d : "0";
  } else {
    hh = d.slice(0, d.length - 2);
    mm = d.slice(-2);
  }
  const text = `${hh}:${mm}`;
  return persian ? toPersianDigits(text) : text;
}

/** Human short label like «۲ ساعت و ۳۰ دقیقه» */
export function humanDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${toPersianDigits(h)} ساعت`);
  if (m > 0) parts.push(`${toPersianDigits(m)} دقیقه`);
  if (!parts.length) return "۰ دقیقه";
  return parts.join(" و ");
}

export function sumMinutes(list: number[]): number {
  return list.reduce((a, b) => a + b, 0);
}

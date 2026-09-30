/** Persian digit + number formatting helpers. */

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

export function toLatinDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** Count-up helper source values etc. */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Plural-friendly Persian join: "۲ گزارش" / "۱۲ گزارش" */
export function faCount(n: number, noun: string): string {
  return `${toPersianDigits(n)} ${noun}`;
}

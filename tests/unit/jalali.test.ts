import { describe, it, expect } from "vitest";
import {
  toJalali, toGregorian, dateToJalali, jalaliToDate, isLeapJalaliYear,
  jalaliMonthLength, isoDate, parseIso, addDays, diffDays, startOfDay,
  isWeekend, formatJalali, relativeDayLabel, jWeekdayIndex, today,
} from "@/lib/jalali";

describe("jalali ↔ gregorian conversion", () => {
  it("converts known anchor dates", () => {
    expect(toJalali(2026, 9, 30)).toEqual({ jy: 1405, jm: 7, jd: 8 });   // مهر ۸
    expect(toJalali(2025, 3, 21)).toEqual({ jy: 1404, jm: 1, jd: 1 });   // نوروز ۱۴۰۴
    expect(toJalali(2024, 3, 20)).toEqual({ jy: 1403, jm: 1, jd: 1 });   // نوروز ۱۴۰۳
    expect(toJalali(2026, 3, 21)).toEqual({ jy: 1405, jm: 1, jd: 1 });   // نوروز ۱۴۰۵
  });

  it("round-trips gregorian → jalali → gregorian", () => {
    for (const [gy, gm, gd] of [[2026, 1, 1], [2026, 6, 15], [2026, 9, 30], [2025, 12, 31], [2024, 2, 29]] as const) {
      const j = toJalali(gy, gm, gd);
      const g = toGregorian(j.jy, j.jm, j.jd);
      expect([g.gy, g.gm, g.gd]).toEqual([gy, gm, gd]);
    }
  });

  it("dateToJalali / jalaliToDate are inverse on UTC-midnight dates", () => {
    const d = new Date(Date.UTC(2026, 8, 30));
    const j = dateToJalali(d);
    expect(j).toEqual({ jy: 1405, jm: 7, jd: 8 });
    expect(isoDate(jalaliToDate(j.jy, j.jm, j.jd))).toBe("2026-09-30");
  });

  it("leap-year detection + month lengths", () => {
    expect(isLeapJalaliYear(1403)).toBe(true);
    expect(isLeapJalaliYear(1404)).toBe(false);
    expect(jalaliMonthLength(1405, 7)).toBe(30);  // مهر
    expect(jalaliMonthLength(1405, 12)).toBe(29); // اسفند غیرکبیسه
    expect(jalaliMonthLength(1403, 12)).toBe(30); // اسفند کبیسه
  });
});

describe("iso helpers", () => {
  it("isoDate/parseIso round-trip", () => {
    const d = parseIso("2026-09-30");
    expect(isoDate(d)).toBe("2026-09-30");
  });

  it("addDays/diffDays arithmetic", () => {
    const d = parseIso("2026-09-30");
    expect(isoDate(addDays(d, 1))).toBe("2026-10-01");
    expect(isoDate(addDays(d, -30))).toBe("2026-08-31");
    expect(diffDays(parseIso("2026-10-01"), d)).toBe(1);
  });

  it("startOfDay keeps the calendar day", () => {
    const d = startOfDay(new Date(2026, 8, 30, 15, 42));
    expect(isoDate(d)).toBe("2026-09-30");
    expect(d.getHours()).toBe(0);
  });
});

describe("weekend / weekday (Jalali weeks start Saturday)", () => {
  it("jWeekdayIndex maps 2026-09-30 (چهارشنبه) to 4", () => {
    expect(jWeekdayIndex(parseIso("2026-09-30"))).toBe(4);
  });

  it("isWeekend flags پنجشنبه/جمعه only", () => {
    // 1405/07/09 = پنجشنبه (4), 1405/07/10 = جمعه (5)
    expect(isWeekend(parseIso("2026-10-01"))).toBe(true);
    expect(isWeekend(parseIso("2026-10-02"))).toBe(true);
    expect(isWeekend(parseIso("2026-09-30"))).toBe(false);
  });
});

describe("formatJalali / relativeDayLabel", () => {
  it("formats styles; short/long/full include the year", () => {
    expect(formatJalali("2026-09-30", "short")).toBe("۱۴۰۵/۰۷/۰۸");
    for (const style of ["long", "full"] as const) {
      const s = formatJalali("2026-09-30", style);
      expect(s).toContain("۱۴۰۵");
      expect(s).toContain("مهر");
    }
    expect(formatJalali("2026-09-30", "medium")).toContain("مهر");
  });

  it("relativeDayLabel: today vs other days", () => {
    const now = today();
    expect(relativeDayLabel(isoDate(now))).toBe("امروز");
    expect(relativeDayLabel(isoDate(addDays(now, -1)))).toBe("دیروز");
    const s = relativeDayLabel(isoDate(addDays(now, -3)));
    expect(s).not.toBe("امروز");
  });
});

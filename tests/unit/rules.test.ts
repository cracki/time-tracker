import { describe, it, expect } from "vitest";
import {
  CONFIG, tehranTodayIso, tehranDaysAgoIso, parseWorkDate, assertWorkDateInRange,
  jalaliWeekday, computeOutsideKind, isValidMobile,
} from "@/lib/server/rules";
import { ServerError } from "@/lib/server/api-helpers";

describe("tehran date helpers", () => {
  it("tehranTodayIso returns yyyy-mm-dd", () => {
    expect(tehranTodayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("tehranDaysAgoIso(0) === today, (1) === yesterday", () => {
    expect(tehranDaysAgoIso(0)).toBe(tehranTodayIso());
    const d1 = new Date(Date.parse(tehranTodayIso() + "T00:00:00Z") - 86_400_000);
    expect(tehranDaysAgoIso(1)).toBe(d1.toISOString().slice(0, 10));
  });
});

describe("parseWorkDate", () => {
  it("accepts valid yyyy-mm-dd", () => {
    expect(parseWorkDate("2026-09-30")).toBe("2026-09-30");
  });

  it("rejects non-ISO / garbage / wrong types", () => {
    expect(() => parseWorkDate("۳۰/۰۹/۲۰۲۶")).toThrow(ServerError);
    expect(() => parseWorkDate("2026-9-3")).toThrow(ServerError);
    expect(() => parseWorkDate(123)).toThrow(ServerError);
    expect(() => parseWorkDate("")).toThrow(ServerError);
  });
});

describe("assertWorkDateInRange (3-day backdate window)", () => {
  it("accepts today and within-window backdates", () => {
    expect(() => assertWorkDateInRange(tehranTodayIso())).not.toThrow();
    expect(() => assertWorkDateInRange(tehranDaysAgoIso(CONFIG.backdateLimitDays))).not.toThrow();
  });

  it("rejects beyond-window backdates and future dates", () => {
    expect(() => assertWorkDateInRange(tehranDaysAgoIso(CONFIG.backdateLimitDays + 1))).toThrow(ServerError);
    const tomorrow = new Date(Date.parse(tehranTodayIso() + "T00:00:00Z") + 86_400_000);
    expect(() => assertWorkDateInRange(tomorrow.toISOString().slice(0, 10))).toThrow(ServerError);
  });
});

describe("jalaliWeekday", () => {
  it("maps 2026-09-30 (چهارشنبه) → 4", () => {
    expect(jalaliWeekday("2026-09-30")).toBe(4);
  });

  it("maps Saturday → 0 and Friday → 6", () => {
    // 2026-10-03 is Saturday, 2026-10-09 is Friday
    expect(jalaliWeekday("2026-10-03")).toBe(0);
    expect(jalaliWeekday("2026-10-09")).toBe(6);
  });
});

describe("computeOutsideKind", () => {
  const workingDays = [0, 1, 2, 3, 4]; // شنبه تا چهارشنبه
  const holidays = new Set(["2026-03-21"]);

  it("holiday beats everything", () => {
    expect(computeOutsideKind("2026-03-21", workingDays, holidays)).toBe("holiday");
  });

  it("non-working day → weekend", () => {
    expect(computeOutsideKind("2026-10-01", workingDays, holidays)).toBe("weekend"); // پنجشنبه
    expect(computeOutsideKind("2026-10-02", workingDays, holidays)).toBe("weekend"); // جمعه
  });

  it("working day → normal", () => {
    expect(computeOutsideKind("2026-09-30", workingDays, holidays)).toBe("normal"); // چهارشنبه
  });
});

describe("isValidMobile", () => {
  it("accepts 09xxxxxxxxx", () => {
    expect(isValidMobile("09121111111")).toBe(true);
    expect(isValidMobile("09901234567")).toBe(true);
  });

  it("rejects wrong prefixes/lengths/types", () => {
    expect(isValidMobile("9121111111")).toBe(false);
    expect(isValidMobile("0912111111")).toBe(false);   // 10 digits
    expect(isValidMobile("091211111112")).toBe(false); // 12 digits
    expect(isValidMobile("+989121111111")).toBe(false);
    expect(isValidMobile(9121111111)).toBe(false);
    expect(isValidMobile(null)).toBe(false);
  });
});

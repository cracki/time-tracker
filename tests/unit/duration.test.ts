import { describe, it, expect } from "vitest";
import { minutesToHHMM, hhmmToMinutes, maskDigitsToHHMM, humanDuration, sumMinutes } from "@/lib/duration";

describe("minutesToHHMM", () => {
  it("formats Persian HH:MM", () => {
    expect(minutesToHHMM(0)).toBe("۰۰:۰۰");
    expect(minutesToHHMM(45)).toBe("۰۰:۴۵");
    expect(minutesToHHMM(90)).toBe("۰۱:۳۰");
    expect(minutesToHHMM(1716)).toBe("۲۸:۳۶"); // hours can exceed 24
  });

  it("latin digits when persian=false", () => {
    expect(minutesToHHMM(90, false)).toBe("01:30");
  });
});

describe("hhmmToMinutes", () => {
  it("parses Persian and latin HH:MM", () => {
    expect(hhmmToMinutes("۰۱:۳۰")).toBe(90);
    expect(hhmmToMinutes("01:30")).toBe(90);
    expect(hhmmToMinutes("۹:۴۵")).toBe(585);
    // hour cap is 23 in the input parser (totals can still DISPLAY beyond it)
    expect(hhmmToMinutes("۲۳:۵۹")).toBe(1439);
    expect(hhmmToMinutes("۲۸:۳۶")).toBeNull();
  });

  it("rejects garbage", () => {
    expect(hhmmToMinutes("abc")).toBeNull();
    expect(hhmmToMinutes("")).toBeNull();
    expect(hhmmToMinutes("۹۰")).toBeNull();
  });

  it("round-trips within the 23:59 parser cap", () => {
    for (const m of [0, 15, 60, 105, 1439]) {
      expect(hhmmToMinutes(minutesToHHMM(m, false))).toBe(m);
    }
  });
});

describe("maskDigitsToHHMM", () => {
  it("builds HH:MM mask from typed digits (persian by default)", () => {
    expect(maskDigitsToHHMM("0130")).toBe("۰۱:۳۰");
    expect(maskDigitsToHHMM("0130", false)).toBe("01:30");
    expect(maskDigitsToHHMM("2", false)).toBe("2:");
    expect(maskDigitsToHHMM("230", false)).toBe("2:30");
  });
});

describe("humanDuration / sumMinutes", () => {
  it("humanDuration reads naturally", () => {
    expect(humanDuration(90)).toContain("۱");
    expect(humanDuration(90)).toContain("۳۰");
  });

  it("sumMinutes adds a list", () => {
    expect(sumMinutes([30, 45, 105])).toBe(180);
    expect(sumMinutes([])).toBe(0);
  });
});

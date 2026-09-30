import { describe, it, expect } from "vitest";
import { toPersianDigits, toLatinDigits, clamp, faCount } from "@/lib/format";

describe("toPersianDigits / toLatinDigits", () => {
  it("converts numbers and strings", () => {
    expect(toPersianDigits(123)).toBe("۱۲۳");
    expect(toPersianDigits("0901")).toBe("۰۹۰۱");
    expect(toLatinDigits("۰۹۰۱")).toBe("0901");
  });

  it("is identity for non-digit chars", () => {
    expect(toPersianDigits("a-b c")).toBe("a-b c");
  });

  it("round-trips", () => {
    expect(toLatinDigits(toPersianDigits("۴۵۶۷۸۹۰123"))).toBe("4567890123");
  });
});

describe("clamp", () => {
  it("clamps within bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe("faCount", () => {
  it("formats counts with Persian digits and noun", () => {
    expect(faCount(3, "گزارش")).toContain("۳");
    expect(faCount(3, "گزارش")).toContain("گزارش");
  });
});

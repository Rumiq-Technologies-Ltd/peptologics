import { describe, expect, it } from "vitest";

import {
  calculateDiscountCents,
  evaluateCoupon,
  findCoupon,
  normalizeCouponCode,
} from "@/features/cart/utils/coupon";

/**
 * The coupon rules, tested as arithmetic rather than through the UI.
 *
 * These matter more than most display logic: the figure this produces is quoted to a
 * customer and then recomputed server-side, so a rounding difference between the two
 * would be a discrepancy on a real order.
 */

describe("normalizeCouponCode", () => {
  it("accepts the code however the visitor happens to type it", () => {
    for (const typed of [" research2026 ", "Research2026", "RESEARCH 2026", "research 2026"]) {
      expect(findCoupon(typed)?.code).toBe("RESEARCH2026");
    }
  });

  /*
   * Spaces are noise from a paste or an autocapitalise; a hyphen is a character
   * someone deliberately put in a code. Stripping it would make a future SAVE-10
   * indistinguishable from SAVE10, so it survives normalisation and therefore does
   * not match a code that has none.
   */
  it("keeps hyphens significant, so hyphenated codes remain possible", () => {
    expect(normalizeCouponCode("research-2026")).toBe("RESEARCH-2026");
    expect(findCoupon("research-2026")).toBeNull();
  });

  it("strips punctuation that a paste or an autocorrect might introduce", () => {
    expect(normalizeCouponCode("  re*search 2026!  ")).toBe("RESEARCH2026");
  });

  it("bounds the length, so a pasted essay is never used as a lookup key", () => {
    expect(normalizeCouponCode("A".repeat(500))).toHaveLength(40);
  });
});

describe("calculateDiscountCents", () => {
  const coupon = { code: "RESEARCH2026", percentOff: 15, label: "15% off your order" };

  it("takes the stated percentage off, in whole cents", () => {
    // A $60 vial: 15% is exactly $9.
    expect(calculateDiscountCents(6000, coupon)).toBe(900);
  });

  it("rounds rather than truncating, so neither party is systematically short", () => {
    // $50.01 at 15% is 750.15 cents.
    expect(calculateDiscountCents(5001, coupon)).toBe(750);
    // $50.03 at 15% is 750.45 cents.
    expect(calculateDiscountCents(5003, coupon)).toBe(750);
    // $50.10 at 15% is 751.5 cents, which rounds up.
    expect(calculateDiscountCents(5010, coupon)).toBe(752);
  });

  it("never exceeds the subtotal, so a total cannot go negative", () => {
    const everything = { code: "X", percentOff: 100, label: "" };
    expect(calculateDiscountCents(1234, everything)).toBe(1234);
  });

  it("is zero on an empty order", () => {
    expect(calculateDiscountCents(0, coupon)).toBe(0);
  });
});

describe("evaluateCoupon", () => {
  it("applies a known code and reports the resulting total", () => {
    const result = evaluateCoupon(20000, "RESEARCH2026");

    expect(result.coupon?.code).toBe("RESEARCH2026");
    expect(result.discountCents).toBe(3000);
    expect(result.totalCents).toBe(17000);
    expect(result.rejection).toBeNull();
  });

  it("reports an unknown code without changing the total", () => {
    const result = evaluateCoupon(20000, "NOTACODE");

    expect(result.coupon).toBeNull();
    expect(result.discountCents).toBe(0);
    expect(result.totalCents).toBe(20000);
    expect(result.rejection).toBe("unknown");
  });

  it("treats blank input as nothing entered rather than as a bad code", () => {
    for (const blank of ["", "   ", null, undefined]) {
      expect(evaluateCoupon(20000, blank).rejection).toBe("empty");
    }
  });

  it("always returns integers, so cents never become floats", () => {
    const result = evaluateCoupon(3333, "RESEARCH2026");

    expect(Number.isInteger(result.discountCents)).toBe(true);
    expect(Number.isInteger(result.totalCents)).toBe(true);
    expect(result.discountCents + result.totalCents).toBe(3333);
  });
});

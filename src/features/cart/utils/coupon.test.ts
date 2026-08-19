import { describe, expect, it } from "vitest";

import {
  calculateDiscountCents,
  COUPONS,
  couponDisplayCode,
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

describe("the referral codes", () => {
  /*
   * Each entry is the code exactly as the client hands it out, paired with the subtotal
   * arithmetic it should produce. Typed with the punctuation and casing from the
   * marketing, because that is what a visitor pastes — if normalisation ever stops
   * forgiving a space or a dot, these fail rather than the customer.
   */
  const REFERRAL_CODES = [
    { promoted: "TimTim", canonical: "TIMTIM" },
    { promoted: "MO.BIOHACK", canonical: "MOBIOHACK" },
    { promoted: "Vincent", canonical: "VINCENT" },
    { promoted: "MSK", canonical: "MSK" },
    { promoted: "Zarmeena", canonical: "ZARMEENA" },
    { promoted: "Tony Black", canonical: "TONYBLACK" },
  ] as const;

  it.each(REFERRAL_CODES)(
    "resolves $promoted as typed, and takes 10% off",
    ({ promoted, canonical }) => {
      const result = evaluateCoupon(20000, promoted);

      expect(result.coupon?.code).toBe(canonical);
      expect(result.coupon?.percentOff).toBe(10);
      expect(result.rejection).toBeNull();
      // $200 at 10% is exactly $20.
      expect(result.discountCents).toBe(2000);
      expect(result.totalCents).toBe(18000);
    },
  );

  it.each(REFERRAL_CODES)(
    "accepts $promoted however it is cased or spaced",
    ({ promoted, canonical }) => {
      for (const typed of [
        promoted,
        promoted.toLowerCase(),
        promoted.toUpperCase(),
        ` ${promoted} `,
      ]) {
        expect(findCoupon(typed)?.code).toBe(canonical);
      }
    },
  );

  it("shows a partner their code the way it was given to them", () => {
    // Normalisation has to strip the dot and the space to match, but the visitor should
    // never be shown a form they did not recognise.
    const promotedForms = REFERRAL_CODES.map((entry) => {
      const coupon = findCoupon(entry.promoted);
      return coupon ? couponDisplayCode(coupon) : null;
    });

    expect(promotedForms).toEqual([
      "TimTim",
      "MO.BIOHACK",
      "Vincent",
      // No `display` set: the canonical code is already the promoted form.
      "MSK",
      "Zarmeena",
      "Tony Black",
    ]);
  });

  it("labels every referral code with the same 10% wording", () => {
    for (const { canonical } of REFERRAL_CODES) {
      expect(findCoupon(canonical)?.label).toBe("10% off your order");
    }
  });
});

describe("the coupon table itself", () => {
  it("has no duplicate canonical codes, so a lookup is unambiguous", () => {
    const codes = COUPONS.map((coupon) => coupon.code);

    expect(new Set(codes).size).toBe(codes.length);
  });

  it("stores every code already canonical, so each one is reachable by typing it", () => {
    // An entry written "Tony Black" in the table could never be matched: normalisation
    // would turn the visitor's input into TONYBLACK and find nothing.
    for (const coupon of COUPONS) {
      expect(normalizeCouponCode(coupon.code)).toBe(coupon.code);
    }
  });

  it("keeps every percentage inside 1–100", () => {
    for (const coupon of COUPONS) {
      expect(coupon.percentOff).toBeGreaterThan(0);
      expect(coupon.percentOff).toBeLessThanOrEqual(100);
    }
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

import type { CartTotals } from "@/features/cart/types/cart";

/**
 * Coupon codes and the arithmetic that applies them.
 *
 * Pure functions, no React and no storage, so the browser and the server can share
 * one definition of what a code is worth. That sharing is the point: the panel shows
 * a discount while the visitor types, and the server recomputes the same figure from
 * the same table at submit time. Two implementations would eventually disagree, and
 * the one the customer saw is the one they will hold us to.
 *
 * **The table below is public.** This module is imported by a Client Component, so
 * every code in it ships in the JavaScript bundle and anyone can read them. That is
 * correct for a promotional code meant to be shared, and wrong for a private or
 * single-customer code — those need a server-only lookup behind an endpoint, because
 * a code nobody can guess is worthless if it is printed in the bundle.
 *
 * All money stays integer cents (ADR-002). Nothing here produces a float.
 */

export interface Coupon {
  /** Canonical form: upper case, no spaces. Compare against `normalizeCouponCode`. */
  code: string;
  /** Whole percent off the order subtotal, 1–100. */
  percentOff: number;
  /** Shown beside the applied code, so the visitor can see what they got. */
  label: string;
}

/**
 * Every code the site accepts.
 *
 * TODO(client): these are marketing terms, not engineering constants. Confirm the
 * expiry, the eligibility and whether the discount is meant to apply before or after
 * shipping — today there is no shipping figure on the site at all, so it applies to
 * the product subtotal and nothing else.
 */
export const COUPONS: readonly Coupon[] = [
  { code: "RESEARCH2026", percentOff: 15, label: "15% off your order" },
] as const;

/** Longest code we will even look up. Slack against a pasted essay, not a rule. */
const MAX_COUPON_LENGTH = 40;

/** Why a code was not applied. `null` alongside a coupon means it was. */
export type CouponRejection =
  /** Nothing entered, or only whitespace. Not an error — nothing to report. */
  | "empty"
  /** Entered, but no such code. */
  | "unknown";

export interface CouponEvaluation {
  /** The matched coupon, or null when nothing was applied. */
  coupon: Coupon | null;
  /** Integer cents taken off the subtotal. Zero when no coupon applied. */
  discountCents: number;
  /** Subtotal minus discount, in integer cents. Never negative. */
  totalCents: number;
  rejection: CouponRejection | null;
}

/**
 * Canonicalises a typed code.
 *
 * Upper-cased and stripped of everything but letters, digits and hyphens, so
 * " research2026 " and "Research 2026" both reach the same entry. Being generous
 * here costs nothing and saves a support email from someone whose phone
 * autocapitalised or whose paste carried a trailing space.
 */
export function normalizeCouponCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, MAX_COUPON_LENGTH);
}

/** The coupon for a typed code, or null. Case and spacing insensitive. */
export function findCoupon(raw: string | null | undefined): Coupon | null {
  if (!raw) return null;

  const normalized = normalizeCouponCode(raw);
  if (normalized.length === 0) return null;

  return COUPONS.find((coupon) => coupon.code === normalized) ?? null;
}

/**
 * The discount a coupon takes off a subtotal, in integer cents.
 *
 * Rounded, not truncated: on a $50.01 subtotal at 15% the exact figure is 750.15
 * cents, and rounding to 750 keeps the arithmetic symmetric rather than always
 * favouring one party by a cent. Clamped to the subtotal so a future 100%-off code
 * can never produce a negative total.
 */
export function calculateDiscountCents(subtotalCents: number, coupon: Coupon): number {
  if (subtotalCents <= 0) return 0;

  const raw = Math.round((subtotalCents * coupon.percentOff) / 100);

  return Math.min(raw, subtotalCents);
}

/**
 * Resolves a typed code against a subtotal.
 *
 * The single entry point both the panel and the service use, so "what does this code
 * do to this order" has exactly one answer.
 */
export function evaluateCoupon(
  subtotalCents: number,
  raw: string | null | undefined,
): CouponEvaluation {
  const entered = raw ? normalizeCouponCode(raw) : "";

  if (entered.length === 0) {
    return { coupon: null, discountCents: 0, totalCents: subtotalCents, rejection: "empty" };
  }

  const coupon = findCoupon(entered);

  if (!coupon) {
    return { coupon: null, discountCents: 0, totalCents: subtotalCents, rejection: "unknown" };
  }

  const discountCents = calculateDiscountCents(subtotalCents, coupon);

  return {
    coupon,
    discountCents,
    totalCents: subtotalCents - discountCents,
    rejection: null,
  };
}

/** Convenience for callers that already hold `CartTotals`. */
export function evaluateCouponForTotals(
  totals: CartTotals,
  raw: string | null | undefined,
): CouponEvaluation {
  return evaluateCoupon(totals.subtotalCents, raw);
}

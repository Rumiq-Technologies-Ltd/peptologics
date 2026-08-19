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
  /**
   * How the code is written in the marketing that carries it, when that differs from
   * the canonical form. Display only — never stored, never compared.
   *
   * Normalisation strips punctuation and spaces, so a code promoted as `MO.BIOHACK`
   * canonicalises to `MOBIOHACK`. Matching has to use the canonical key or nobody
   * could type the code at all, but echoing `MOBIOHACK` back at someone who took it
   * from an influencer's bio makes them wonder whether they used the right one. This
   * field is what they see; `code` is what the system uses.
   */
  display?: string;
  /** Whole percent off the order subtotal, 1–100. */
  percentOff: number;
  /** Shown beside the applied code, so the visitor can see what they got. */
  label: string;
}

/** The partner rate. Every referral code below is worth the same 10%. */
const PARTNER_PERCENT_OFF = 10;
const PARTNER_LABEL = `${PARTNER_PERCENT_OFF}% off your order`;

/**
 * Every code the site accepts.
 *
 * TODO(client): these are marketing terms, not engineering constants. Confirm the
 * expiry, the eligibility and whether the discount is meant to apply before or after
 * shipping — today there is no shipping figure on the site at all, so it applies to
 * the product subtotal and nothing else.
 *
 * The referral codes added on 18 Aug 2026 are personal handles rather than campaign
 * slugs, so two of them carry a `display` form: `MO.BIOHACK` and `Tony Black` reach the
 * lookup as `MOBIOHACK` and `TONYBLACK` once normalised, and the visitor sees the
 * version they were given.
 *
 * `MSK` is three characters, which is short enough to be guessed by someone trying.
 * That is a commercial decision rather than a bug — the discount is 10% off an inquiry
 * that a representative prices by hand before anything is arranged, so a guessed code
 * costs a conversation, not money. Flagged rather than changed.
 */
export const COUPONS: readonly Coupon[] = [
  { code: "RESEARCH2026", percentOff: 15, label: "15% off your order" },
  { code: "TIMTIM", display: "TimTim", percentOff: PARTNER_PERCENT_OFF, label: PARTNER_LABEL },
  {
    code: "MOBIOHACK",
    display: "MO.BIOHACK",
    percentOff: PARTNER_PERCENT_OFF,
    label: PARTNER_LABEL,
  },
  { code: "VINCENT", display: "Vincent", percentOff: PARTNER_PERCENT_OFF, label: PARTNER_LABEL },
  { code: "MSK", percentOff: PARTNER_PERCENT_OFF, label: PARTNER_LABEL },
  { code: "ZARMEENA", display: "Zarmeena", percentOff: PARTNER_PERCENT_OFF, label: PARTNER_LABEL },
  {
    code: "TONYBLACK",
    display: "Tony Black",
    percentOff: PARTNER_PERCENT_OFF,
    label: PARTNER_LABEL,
  },
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

/**
 * How a coupon should be written for the visitor: its promoted form when it has one,
 * otherwise the canonical code.
 *
 * A function rather than every caller reaching for `display ?? code`, so a surface that
 * forgets cannot quietly show the canonical form on its own.
 */
export function couponDisplayCode(coupon: Coupon): string {
  return coupon.display ?? coupon.code;
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

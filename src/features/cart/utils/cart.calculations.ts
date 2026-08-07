import { MAX_DISTINCT_LINES, MAX_LINE_QUANTITY, MIN_LINE_QUANTITY } from "@/constants/business";
import type { CartItem, CartLine, CartTotals } from "@/features/cart/types/cart";
import type { Product } from "@/features/products/types/product";

/**
 * Every calculation and coercion the inquiry list needs, as pure functions.
 *
 * No React, no store, no storage. The store calls these; components call these.
 * Keeping them here is what makes the quantity bounds, the archived-product drop
 * and the subtotal arithmetic unit-testable without mounting anything (Phase 8).
 *
 * All money is integer cents (ADR-002). Nothing in this file produces a float.
 */

/** Longest plausible product ID. A UUID is 36 characters; this is slack, not a rule. */
const MAX_PRODUCT_ID_LENGTH = 64;

/**
 * Forces a quantity into the permitted range.
 *
 * A non-finite or fractional input collapses to the minimum rather than throwing —
 * the value can arrive from `localStorage`, which the visitor can edit by hand.
 */
export function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return MIN_LINE_QUANTITY;

  const whole = Math.trunc(value);

  if (whole < MIN_LINE_QUANTITY) return MIN_LINE_QUANTITY;
  if (whole > MAX_LINE_QUANTITY) return MAX_LINE_QUANTITY;

  return whole;
}

/** Quantity of one product on the list. Zero when it is not on the list at all. */
export function findQuantity(items: readonly CartItem[], productId: string): number {
  return items.find((item) => item.productId === productId)?.quantity ?? 0;
}

/**
 * Coerces an untrusted persisted payload into a valid item list.
 *
 * `localStorage` is writable by anyone at the keyboard, so this treats the stored
 * value exactly like a request body: unknown shape in, valid shape out, no throw.
 * Anything unrecognisable is dropped rather than repaired — the cost of dropping a
 * line is one re-add, the cost of trusting it is a corrupt list.
 */
export function parsePersistedItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const items: CartItem[] = [];

  for (const candidate of value) {
    if (typeof candidate !== "object" || candidate === null) continue;

    const { productId, quantity } = candidate as Partial<CartItem>;

    if (typeof productId !== "string") continue;
    if (productId.length === 0 || productId.length > MAX_PRODUCT_ID_LENGTH) continue;
    if (typeof quantity !== "number") continue;

    // A duplicate ID would give one product two rows and double its subtotal.
    if (seen.has(productId)) continue;

    seen.add(productId);
    items.push({ productId, quantity: clampQuantity(quantity) });

    if (items.length >= MAX_DISTINCT_LINES) break;
  }

  return items;
}

/**
 * Rejoins persisted items with the current catalog.
 *
 * The catalog argument must be the *active* product set. An item whose product is
 * missing from it — archived, out of stock, deleted — produces no line and simply
 * disappears from the list. That is the whole reason only IDs are persisted
 * (ADR-010): there is no stale name or price to fall back on, so a withdrawn
 * product cannot be quoted.
 *
 * Insertion order is preserved, so the list reads in the order the visitor built it.
 */
export function resolveCartLines(
  items: readonly CartItem[],
  catalog: readonly Product[],
): CartLine[] {
  if (items.length === 0 || catalog.length === 0) return [];

  const byId = new Map(catalog.map((product) => [product.id, product]));
  const lines: CartLine[] = [];

  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product) continue;

    const quantity = clampQuantity(item.quantity);

    lines.push({
      product,
      quantity,
      lineTotalCents: product.priceCents * quantity,
    });
  }

  return lines;
}

/** Totals for a resolved line set. Integer arithmetic only. */
export function calculateTotals(lines: readonly CartLine[]): CartTotals {
  let unitCount = 0;
  let subtotalCents = 0;

  for (const line of lines) {
    unitCount += line.quantity;
    subtotalCents += line.lineTotalCents;
  }

  return { lineCount: lines.length, unitCount, subtotalCents };
}

/** Sum of quantities across persisted items. Used by the header badge, which has no catalog. */
export function countUnits(items: readonly CartItem[]): number {
  let total = 0;
  for (const item of items) total += item.quantity;
  return total;
}

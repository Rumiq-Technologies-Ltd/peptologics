/**
 * The inquiry list's domain types.
 *
 * Two shapes, deliberately separate:
 *
 * - `CartItem` is what persists. Product ID and quantity, nothing else (ADR-010).
 *   No name and no price, so stale `localStorage` can never shadow a catalog
 *   change and an archived product cannot linger with a price beside it.
 * - `CartLine` is what renders. A persisted item rejoined with the *current*
 *   catalog row, produced at render time and never stored.
 */

import type { Product } from "@/features/products/types/product";

/** The persisted unit. The only thing that ever reaches `localStorage`. */
export interface CartItem {
  productId: string;
  quantity: number;
}

/** A persisted item resolved against the live catalog. Render-time only. */
export interface CartLine {
  product: Product;
  quantity: number;
  /**
   * Quantity × the current list price, in integer cents.
   *
   * An estimate for display. The server recomputes every figure from its own
   * catalog read at submit time and ignores anything the browser sends (ADR-005).
   */
  lineTotalCents: number;
}

export interface CartTotals {
  /** Distinct products on the list. */
  lineCount: number;
  /** Sum of quantities across all lines. */
  unitCount: number;
  /** Estimated subtotal in integer cents. */
  subtotalCents: number;
}

/**
 * What an add attempt actually did.
 *
 * Returned rather than thrown: hitting a list limit is an ordinary outcome the UI
 * should explain, not an exception. The caller decides how to surface it.
 */
export type CartAddOutcome =
  /** New line created. */
  | "added"
  /** Existing line's quantity went up. */
  | "increased"
  /** Quantity would have exceeded the per-line cap, so it was clamped. */
  | "quantity_capped"
  /** The list already holds the maximum number of distinct products. */
  | "line_limit_reached";

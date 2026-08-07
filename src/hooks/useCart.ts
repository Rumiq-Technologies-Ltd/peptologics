"use client";

import { useMemo } from "react";

import type { CartItem, CartLine, CartTotals } from "@/features/cart/types/cart";
import {
  calculateTotals,
  countUnits,
  findQuantity,
  resolveCartLines,
} from "@/features/cart/utils/cart.calculations";
import type { Product } from "@/features/products/types/product";
import { cartActions, useCartStore } from "@/store/cart.store";

/**
 * Read access to the inquiry list.
 *
 * Every hook here selects the **narrowest** value its caller needs, and each one
 * returns a primitive or a reference the store itself owns. That is not a style
 * preference: Zustand compares snapshots with `Object.is`, so a catalog row
 * subscribed to `useCartQuantity(id)` re-renders only when *its own* number
 * changes. Subscribing rows to the whole `items` array instead would re-render all
 * forty on every click.
 *
 * The corollary: never compute a new array or object inside a selector. A fresh
 * reference on every snapshot read makes `useSyncExternalStore` believe the store
 * changed and loops. Array work belongs in `useMemo`, after selection — which is
 * exactly what `useCartLines` does.
 *
 * Mutations do not go through a hook at all; import `cartActions`, re-exported
 * below, so a button that only writes never subscribes to anything.
 */

export { cartActions };

/** Whether the persisted list has been read. Controls must be disabled until true. */
export function useCartHasHydrated(): boolean {
  return useCartStore((state) => state.hasHydrated);
}

/** The raw persisted items. Reference is owned by the store, so it is stable. */
export function useCartItems(): CartItem[] {
  return useCartStore((state) => state.items);
}

/** Quantity of one product. Zero when it is not on the list. */
export function useCartQuantity(productId: string): number {
  return useCartStore((state) => findQuantity(state.items, productId));
}

/** Distinct products on the list. */
export function useCartLineCount(): number {
  return useCartStore((state) => state.items.length);
}

/**
 * Total units across the list.
 *
 * Derived inside the selector deliberately — it reduces to a number, so the
 * snapshot stays referentially stable and the header badge re-renders only when the
 * count itself changes.
 */
export function useCartUnitCount(): number {
  return useCartStore((state) => countUnits(state.items));
}

export interface CartSummary {
  lines: CartLine[];
  totals: CartTotals;
}

/**
 * The persisted list resolved against a catalog, with totals.
 *
 * `catalog` comes from a Server Component's read and is passed down as props: the
 * store holds IDs only, and the browser must never query the database. Products
 * missing from the catalog produce no line, so a withdrawn product drops out here
 * rather than being displayed from a stale record (ADR-010).
 */
export function useCartSummary(catalog: readonly Product[]): CartSummary {
  const items = useCartItems();

  return useMemo(() => {
    const lines = resolveCartLines(items, catalog);
    return { lines, totals: calculateTotals(lines) };
  }, [items, catalog]);
}

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { MAX_DISTINCT_LINES, MIN_LINE_QUANTITY } from "@/constants/business";
import { CART_STORAGE_KEY, CART_STORAGE_VERSION } from "@/constants/site";
import type { CartAddOutcome, CartItem } from "@/features/cart/types/cart";
import { clampQuantity, parsePersistedItems } from "@/features/cart/utils/cart.calculations";
import { normalizeCouponCode } from "@/features/cart/utils/coupon";
import { logger } from "@/lib/logger";

/**
 * Coerces a persisted coupon code, which is untrusted for the same reason the items
 * are: `localStorage` is writable by anyone at the keyboard. Anything that is not a
 * string, or normalises to nothing, becomes null rather than being repaired.
 */
function parsePersistedCouponCode(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = normalizeCouponCode(value);
  return normalized.length > 0 ? normalized : null;
}

/**
 * The inquiry list store.
 *
 * Zustand rather than Context + `useReducer` for the `persist` middleware alone;
 * correct SSR rehydration is subtle and not worth hand-rolling (ADR-010).
 *
 * Three things here are load-bearing rather than stylistic:
 *
 * 1. `skipHydration: true`. Without it, `persist` reads `localStorage` while the
 *    module evaluates, so the very first client render disagrees with the
 *    server-rendered HTML and React reports a hydration mismatch. Instead the
 *    store starts empty — identical to the server — and `CartHydrator` calls
 *    `rehydrate()` in an effect, after hydration has completed.
 * 2. `partialize` stores `items` only. Never a name, never a price. A price change
 *    in Supabase therefore cannot be shadowed by a stale record, and an archived
 *    product has nothing to be rendered from (ADR-010, ADR-005).
 * 3. `merge` re-parses whatever came out of storage. `localStorage` is writable by
 *    anyone at the keyboard, so the persisted payload is treated exactly like a
 *    request body.
 *
 * Actions live in the store rather than in components, and are also exposed as
 * `cartActions` for callers that need to mutate without subscribing.
 */

/** The slice that reaches storage. Everything else is derived or ephemeral. */
type PersistedCart = Pick<CartState, "items" | "couponCode">;

export interface CartState {
  /** Insertion-ordered. The order the visitor built the list in. */
  items: CartItem[];
  /**
   * The applied coupon code, canonicalised, or null.
   *
   * The *code* persists, never the discount. Same reasoning as prices (ADR-005): a
   * stored amount could be edited in `localStorage` and would go stale the moment the
   * list changed, whereas a code is re-evaluated against the live subtotal on every
   * render and again by the server at submit.
   *
   * Added without bumping `CART_STORAGE_VERSION`: `merge` and `migrate` both read
   * fields explicitly and default this one to null, so a v1 record written before
   * this field existed still loads. Bumping the version would have discarded every
   * saved list in the wild to add an optional field.
   */
  couponCode: string | null;
  /**
   * Whether `rehydrate()` has finished, successfully or not.
   *
   * Components must gate their controls on this. A click that lands before
   * rehydration would be overwritten by the incoming persisted state, silently
   * losing what the visitor just did.
   */
  hasHydrated: boolean;

  /** Adds a product, or increases an existing line. Reports what it actually did. */
  addItem: (productId: string, quantity?: number) => CartAddOutcome;
  /** Sets an existing line's quantity. Zero or less removes the line. */
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  /**
   * Stores a coupon code, or clears it with null.
   *
   * Accepts whatever was typed and canonicalises it. An unknown code is still stored:
   * whether it matches anything is a question for `evaluateCoupon` against the current
   * subtotal, not for the store, and keeping the text lets the panel explain that the
   * code was not recognised instead of silently emptying the field.
   */
  setCouponCode: (code: string | null) => void;
  /**
   * Drops any line whose product is absent from the given ID set.
   *
   * Call this **only** with a complete active-catalog ID list — the `/cart` page's
   * server read. Passing a filtered or searched subset would delete lines the
   * visitor still has, which is why the catalog pages do not call it.
   */
  reconcile: (availableProductIds: readonly string[]) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      couponCode: null,
      hasHydrated: false,

      addItem: (productId, quantity = MIN_LINE_QUANTITY): CartAddOutcome => {
        const { items } = get();
        const existing = items.find((item) => item.productId === productId);

        // A requested amount is clamped before it is used, so a hand-crafted call
        // cannot push a line past the cap in one step.
        const requestedIncrease = clampQuantity(quantity);

        if (!existing) {
          if (items.length >= MAX_DISTINCT_LINES) return "line_limit_reached";

          set({ items: [...items, { productId, quantity: requestedIncrease }] });
          return requestedIncrease < quantity ? "quantity_capped" : "added";
        }

        const desired = existing.quantity + requestedIncrease;
        const next = clampQuantity(desired);

        // Already at the cap: nothing changes, but the caller still needs to know
        // why the number did not move.
        if (next === existing.quantity) return "quantity_capped";

        set({
          items: items.map((item) =>
            item.productId === productId ? { ...item, quantity: next } : item,
          ),
        });

        return next < desired ? "quantity_capped" : "increased";
      },

      setQuantity: (productId, quantity) => {
        if (quantity < MIN_LINE_QUANTITY) {
          get().removeItem(productId);
          return;
        }

        const next = clampQuantity(quantity);

        set({
          items: get().items.map((item) =>
            item.productId === productId ? { ...item, quantity: next } : item,
          ),
        });
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((item) => item.productId !== productId) });
      },

      clear: () => {
        // The coupon goes with the list. Leaving a code applied to an emptied list
        // would greet the next visit with a discount on nothing.
        set({ items: [], couponCode: null });
      },

      setCouponCode: (code) => {
        if (code === null) {
          set({ couponCode: null });
          return;
        }

        const normalized = normalizeCouponCode(code);
        set({ couponCode: normalized.length > 0 ? normalized : null });
      },

      reconcile: (availableProductIds) => {
        const { items } = get();
        const available = new Set(availableProductIds);
        const kept = items.filter((item) => available.has(item.productId));

        // Same length means nothing was withdrawn. Skipping the write avoids a
        // pointless re-render of every subscribed row and a pointless storage write.
        if (kept.length === items.length) return;

        set({ items: kept });
      },
    }),
    {
      name: CART_STORAGE_KEY,
      version: CART_STORAGE_VERSION,
      skipHydration: true,

      partialize: (state): PersistedCart => ({
        items: state.items,
        couponCode: state.couponCode,
      }),

      /**
       * No earlier schema has ever shipped, so a version mismatch means a record
       * this build cannot interpret. Discarding it is right: the list is cheap to
       * rebuild and expensive to misread.
       */
      migrate: (persistedState, version): PersistedCart => {
        if (version !== CART_STORAGE_VERSION) return { items: [], couponCode: null };

        const stored = persistedState as Partial<PersistedCart> | null;

        return {
          items: parsePersistedItems(stored?.items),
          couponCode: parsePersistedCouponCode(stored?.couponCode),
        };
      },

      merge: (persistedState, currentState): CartState => {
        const stored = persistedState as Partial<PersistedCart> | null;

        return {
          ...currentState,
          items: parsePersistedItems(stored?.items),
          couponCode: parsePersistedCouponCode(stored?.couponCode),
        };
      },

      /**
       * `hasHydrated` is set on **both** paths. A quota error or a corrupt record
       * must not leave the UI disabled forever — the visitor simply starts from an
       * empty list, which is the safe direction to fail.
       */
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          logger.warn("cart_rehydrate_failed", { error });
        }

        useCartStore.setState({ hasHydrated: true });
      },
    },
  ),
);

/**
 * Actions bound outside React.
 *
 * Reading actions through a selector would subscribe the component to the store
 * for values that never change. These are stable references, so a component that
 * only mutates — a "clear list" button, for instance — re-renders never.
 */
export const cartActions = {
  addItem: (productId: string, quantity?: number): CartAddOutcome =>
    useCartStore.getState().addItem(productId, quantity),
  setQuantity: (productId: string, quantity: number): void =>
    useCartStore.getState().setQuantity(productId, quantity),
  removeItem: (productId: string): void => useCartStore.getState().removeItem(productId),
  clear: (): void => useCartStore.getState().clear(),
  setCouponCode: (code: string | null): void => useCartStore.getState().setCouponCode(code),
  reconcile: (availableProductIds: readonly string[]): void =>
    useCartStore.getState().reconcile(availableProductIds),
} as const;

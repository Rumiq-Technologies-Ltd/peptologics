"use client";

import { useEffect } from "react";

import { useCartStore } from "@/store/cart.store";

/**
 * Reads the persisted inquiry list, once, after hydration.
 *
 * The store sets `skipHydration: true`, so `persist` never touches
 * `localStorage` on its own. Without that, the first client render would already
 * hold the visitor's saved lines while the server-rendered HTML held none, and
 * React would report a hydration mismatch and re-render the subtree from the
 * nearest boundary — the same class of failure that ADR-018 documents on `<html>`.
 *
 * So rehydration is explicit and happens here, in an effect, after the tree has
 * hydrated. `onRehydrateStorage` in the store flips `hasHydrated` on both the
 * success and the failure path, so a corrupt record or a blocked storage API leaves
 * the UI working with an empty list rather than permanently disabled.
 *
 * Renders nothing. It exists to hold one effect at the root of the client tree, so
 * the layout it sits in stays a Server Component.
 */
export function CartHydrator() {
  useEffect(() => {
    // Idempotent, which matters under StrictMode's double-invoked effects: a second
    // rehydrate simply re-reads the same record and merges the same result.
    void useCartStore.persist.rehydrate();
  }, []);

  return null;
}

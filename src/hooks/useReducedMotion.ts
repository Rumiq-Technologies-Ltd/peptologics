"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether the visitor has asked for reduced motion.
 *
 * `matchMedia` is an external store, so it is read through `useSyncExternalStore`
 * rather than assigned into state from an effect — the same pattern the disclaimer
 * gate uses for `localStorage`. That also means a change to the OS setting takes
 * effect immediately, without a reload.
 *
 * The server snapshot is `true`: motion is opt-in on the very first frame. Guessing
 * "animate" and being wrong means shipping motion to someone who asked not to have
 * it; guessing "still" and being wrong costs one frame of stillness.
 *
 * `globals.css` already disables CSS transitions under this query. This hook is for
 * the animation loops CSS cannot reach.
 */

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onStoreChange: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

export function useReducedMotion(): boolean {
  const getSnapshot = useCallback(() => window.matchMedia(QUERY).matches, []);
  const getServerSnapshot = useCallback(() => true, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

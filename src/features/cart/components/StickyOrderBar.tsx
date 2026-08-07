"use client";

import { useEffect } from "react";

import { MobileOrderDrawer } from "@/features/cart/components/MobileOrderDrawer";
import { useCartHasHydrated, useCartSummary } from "@/hooks/useCart";
import type { Product } from "@/features/products/types/product";
import { formatCurrencyExact } from "@/utils/formatCurrency";

/**
 * The running total, pinned to the bottom of a phone viewport.
 *
 * Renders nothing until the list has something on it. A permanent bar would eat
 * ~72px of a viewport that already carries the compliance strip, on a page whose job
 * is reading a table of figures — and it would say "$0.00", which is not worth the
 * height.
 *
 * Because the bar is `fixed`, it covers whatever the page ends with. An in-flow
 * spacer beside the bar does not help — the bar lives inside the page section and
 * the footer comes after it, so with a spacer the footer's last ~69px were still
 * underneath the bar (measured at 375px). Clearance therefore comes from padding on
 * `<body>`, applied through a data attribute this component owns and a rule in
 * globals.css that drops it again from `lg`.
 *
 * Hidden from `lg`, where `OrderSummaryPanel` shows the same figures without
 * covering anything.
 */
export interface StickyOrderBarProps {
  catalog: readonly Product[];
}

export function StickyOrderBar({ catalog }: StickyOrderBarProps) {
  const { totals } = useCartSummary(catalog);
  const hasHydrated = useCartHasHydrated();

  const isVisible = hasHydrated && totals.lineCount > 0;

  useEffect(() => {
    if (!isVisible) return;

    document.body.dataset.orderBar = "visible";

    // Cleared on unmount as well as when the list empties, so navigating to a page
    // without a bar does not leave dead space at the bottom of it.
    return () => {
      delete document.body.dataset.orderBar;
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Inquiry list summary"
      className="border-ink-200 fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 backdrop-blur-sm lg:hidden"
      // Clears the iOS home indicator without adding padding on hardware that has none.
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 pt-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-ink-600 text-xs">
            {totals.lineCount} {totals.lineCount === 1 ? "compound" : "compounds"} ·{" "}
            {totals.unitCount} {totals.unitCount === 1 ? "vial" : "vials"}
          </p>
          <p className="text-ink-950 font-mono text-base font-bold tabular-nums">
            {formatCurrencyExact(totals.subtotalCents)}
            <span className="text-ink-500 ml-1 font-sans text-xs font-normal">estimated</span>
          </p>
        </div>

        <MobileOrderDrawer catalog={catalog} />
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";

import { Skeleton } from "@/components/ui/skeleton";
import { MESSAGES } from "@/constants/messages";
import { ROUTES } from "@/constants/routes";
import { CartLineList } from "@/features/cart/components/CartLineList";
import { useCartHasHydrated, useCartSummary } from "@/hooks/useCart";
import type { Product } from "@/features/products/types/product";
import { formatCurrencyExact } from "@/utils/formatCurrency";

/**
 * What the visitor is about to ask for, shown beside the form.
 *
 * Quantities stay editable here on purpose. Discovering you wanted two vials while
 * filling in an address should not mean navigating away and losing the form's
 * contents — and `CartLineList` already provides exactly the controls needed, so
 * reusing it costs nothing.
 *
 * The subtotal is labelled an estimate everywhere it appears, including here. Nothing
 * on this panel is sent to the server: the request carries product IDs and quantities
 * only (ADR-005).
 */
export interface InquirySummaryProps {
  catalog: readonly Product[];
}

export function InquirySummary({ catalog }: InquirySummaryProps) {
  const { lines, totals } = useCartSummary(catalog);
  const hasHydrated = useCartHasHydrated();

  return (
    <aside
      aria-labelledby="inquiry-summary-heading"
      className="border-ink-200 shadow-panel h-fit rounded-xl border bg-white p-5 lg:sticky lg:top-8"
    >
      <h2 id="inquiry-summary-heading" className="text-ink-950 font-semibold">
        Your inquiry
      </h2>

      {!hasHydrated ? (
        // The list lives in localStorage, which cannot be read until after hydration.
        // That is the only wait on this page, and it is client-side (ADR-017).
        <div className="mt-5 space-y-3" aria-hidden="true">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : lines.length === 0 ? (
        <div className="mt-4">
          <p className="text-ink-700 text-sm font-medium">{MESSAGES.cart.empty}</p>
          <p className="text-ink-600 mt-1 text-sm">{MESSAGES.cart.emptyDetail}</p>
          <Link
            href={ROUTES.products}
            className="text-brand-600 mt-3 inline-block text-sm font-medium underline underline-offset-2"
          >
            Browse the catalog
          </Link>
        </div>
      ) : (
        <>
          <CartLineList lines={lines} className="mt-2" />

          <div className="border-ink-200 mt-4 border-t pt-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-ink-700 text-sm font-medium">
                Estimated subtotal
                <span className="text-ink-500 ml-1 font-normal">
                  ({totals.unitCount} {totals.unitCount === 1 ? "vial" : "vials"})
                </span>
              </span>
              <span className="text-ink-950 font-mono text-lg font-bold tabular-nums">
                {formatCurrencyExact(totals.subtotalCents)}
              </span>
            </div>

            <p className="text-ink-600 mt-2 text-xs">{MESSAGES.cart.estimateNotice}</p>
          </div>
        </>
      )}
    </aside>
  );
}

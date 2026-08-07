"use client";

import Link from "next/link";
import { ClipboardListIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MESSAGES } from "@/constants/messages";
import { ROUTES } from "@/constants/routes";
import { CartLineList } from "@/features/cart/components/CartLineList";
import { cartActions, useCartHasHydrated, useCartSummary } from "@/hooks/useCart";
import type { Product } from "@/features/products/types/product";
import { formatCurrencyExact } from "@/utils/formatCurrency";
import { cn } from "@/utils/cn";

/**
 * The desktop inquiry-list panel, sticky beside the catalog.
 *
 * Takes the catalog as a prop rather than fetching it. The store persists product
 * IDs only, so the names and prices shown here come from the same server read that
 * rendered the rows on the left — no client-side query, no second source of pricing
 * truth, and the page stays statically prerenderable.
 *
 * Hidden below `lg`, where `StickyOrderBar` and `MobileOrderDrawer` take over: a
 * sidebar on a phone would either push the catalog off-screen or sit below it, out
 * of sight, on the one surface where the running total matters most.
 */
export interface OrderSummaryPanelProps {
  catalog: readonly Product[];
  className?: string;
}

export function OrderSummaryPanel({ catalog, className }: OrderSummaryPanelProps) {
  const { lines, totals } = useCartSummary(catalog);
  const hasHydrated = useCartHasHydrated();

  return (
    <aside
      aria-labelledby="inquiry-list-heading"
      className={cn(
        "border-ink-200 shadow-panel rounded-xl border bg-white p-5",
        "lg:sticky lg:top-8",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <ClipboardListIcon className="text-brand-800 size-5" aria-hidden="true" />
        <h2 id="inquiry-list-heading" className="text-ink-950 font-semibold">
          Your inquiry list
        </h2>
      </div>

      {!hasHydrated ? (
        /*
          The one genuine wait on this page, and it is client-side: the catalog HTML
          arrives complete from the CDN, while the selection lives in localStorage and
          cannot be read until after hydration. Hence a skeleton here rather than a
          route-level loading.tsx, which on a prerendered route would never be
          replaced (ADR-017).
        */
        <div className="mt-5 space-y-3" aria-hidden="true">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : lines.length === 0 ? (
        <div className="mt-4">
          <p className="text-ink-700 text-sm font-medium">{MESSAGES.cart.empty}</p>
          <p className="text-ink-600 mt-1 text-sm">{MESSAGES.cart.emptyDetail}</p>
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

            <Button asChild size="lg" className="mt-4 w-full">
              <Link href={ROUTES.cart}>Review inquiry list</Link>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              onClick={() => {
                cartActions.clear();
                toast.success(MESSAGES.cart.cleared);
              }}
            >
              Clear list
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}

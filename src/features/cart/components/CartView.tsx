"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MESSAGES } from "@/constants/messages";
import { ROUTES } from "@/constants/routes";
import { CartLineList } from "@/features/cart/components/CartLineList";
import { cartActions, useCartHasHydrated, useCartSummary } from "@/hooks/useCart";
import type { Product } from "@/features/products/types/product";
import { formatCurrencyExact } from "@/utils/formatCurrency";

/**
 * The `/cart` page body.
 *
 * Receives the full active catalog from the page's server read. Two things follow
 * from "full":
 *
 * - Lines can be resolved without a client-side query, so the route stays
 *   statically prerenderable and no price ever comes from `localStorage`.
 * - `reconcile` is safe to call here and nowhere else. It deletes any line whose
 *   product is absent from the list it is given, which is correct against the
 *   complete active catalog and destructive against a filtered one.
 */
export interface CartViewProps {
  catalog: readonly Product[];
}

export function CartView({ catalog }: CartViewProps) {
  const { lines, totals } = useCartSummary(catalog);
  const hasHydrated = useCartHasHydrated();

  const catalogIds = useMemo(() => catalog.map((product) => product.id), [catalog]);

  /*
   * Withdrawn products already fail to produce a line, so this is not what makes
   * them disappear from the page — `resolveCartLines` does that. It is what stops
   * the dead ID sitting in storage indefinitely and travelling to the inquiry
   * endpoint later.
   */
  useEffect(() => {
    if (!hasHydrated) return;
    cartActions.reconcile(catalogIds);
  }, [hasHydrated, catalogIds]);

  if (!hasHydrated) {
    return (
      <div className="mt-10 space-y-4" aria-busy="true" aria-label="Loading your inquiry list">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-12 w-1/3" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="border-ink-200 mt-10 rounded-xl border bg-white p-8">
        <p className="text-ink-950 font-semibold">{MESSAGES.cart.empty}</p>
        <p className="text-ink-600 mt-1 text-sm">{MESSAGES.cart.emptyDetail}</p>

        <Button asChild className="mt-6">
          <Link href={ROUTES.products}>Browse the catalog</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[7fr_4fr] lg:gap-12">
      <div className="border-ink-200 shadow-panel rounded-xl border bg-white p-5 sm:p-6">
        <h2 className="text-ink-950 text-sm font-semibold">
          {totals.lineCount} {totals.lineCount === 1 ? "compound" : "compounds"} selected
        </h2>

        <CartLineList lines={lines} density="detailed" className="mt-2" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => {
            cartActions.clear();
            toast.success(MESSAGES.cart.cleared);
          }}
        >
          Clear list
        </Button>
      </div>

      <aside className="border-ink-200 shadow-panel h-fit rounded-xl border bg-white p-5 lg:sticky lg:top-8">
        <h2 className="text-ink-950 font-semibold">Summary</h2>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-ink-600">Vials</dt>
            <dd className="text-ink-950 font-mono tabular-nums">{totals.unitCount}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-ink-600">Shipping</dt>
            <dd className="text-ink-800">Confirmed by a representative</dd>
          </div>
        </dl>

        <div className="border-ink-200 mt-4 flex items-baseline justify-between gap-4 border-t pt-4">
          <span className="text-ink-950 font-semibold">Estimated subtotal</span>
          <span className="text-ink-950 font-mono text-xl font-bold tabular-nums">
            {formatCurrencyExact(totals.subtotalCents)}
          </span>
        </div>

        <p className="text-ink-600 mt-2 text-xs">{MESSAGES.cart.estimateNotice}</p>

        <Button asChild size="lg" className="mt-5 w-full">
          <Link href={ROUTES.inquiry}>
            Request a quotation
            <ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>

        <Button asChild variant="outline" size="lg" className="mt-2 w-full">
          <Link href={ROUTES.products}>Add more compounds</Link>
        </Button>

        <p className="text-ink-600 mt-4 text-xs">
          No payment is taken on this website. A representative confirms availability, lot
          documentation and final pricing before any transaction.
        </p>
      </aside>
    </div>
  );
}

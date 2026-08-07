"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { MESSAGES } from "@/constants/messages";
import { ROUTES } from "@/constants/routes";
import { CartLineList } from "@/features/cart/components/CartLineList";
import { cartActions, useCartSummary } from "@/hooks/useCart";
import type { Product } from "@/features/products/types/product";
import { formatCurrencyExact } from "@/utils/formatCurrency";

/**
 * The phone-sized inquiry list, in a bottom sheet.
 *
 * Radix's Sheet is right here for the same reasons it is right for the mobile nav
 * and wrong for the disclaimer gate: Escape *should* close a review drawer, focus
 * *should* return to the trigger, and the page behind *should* be inert while it is
 * open. None of that is true of a compliance gate.
 *
 * Opens from the bottom, where the trigger is. A drawer that slid in from the side
 * would travel away from the thumb that summoned it.
 */
export interface MobileOrderDrawerProps {
  catalog: readonly Product[];
}

export function MobileOrderDrawer({ catalog }: MobileOrderDrawerProps) {
  const { lines, totals } = useCartSummary(catalog);
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" size="sm" variant="secondary" className="min-h-11 shrink-0">
          Review
        </Button>
      </SheetTrigger>

      <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto">
        <SheetHeader className="border-ink-200 border-b">
          <SheetTitle className="text-left">Your inquiry list</SheetTitle>
          <SheetDescription className="text-left">{MESSAGES.cart.estimateNotice}</SheetDescription>
        </SheetHeader>

        <div className="px-4">
          {lines.length === 0 ? (
            <div className="py-6">
              <p className="text-ink-700 text-sm font-medium">{MESSAGES.cart.empty}</p>
              <p className="text-ink-600 mt-1 text-sm">{MESSAGES.cart.emptyDetail}</p>
            </div>
          ) : (
            <CartLineList lines={lines} />
          )}
        </div>

        <SheetFooter className="border-ink-200 border-t">
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

          <Button asChild size="lg" className="w-full">
            {/* Closing explicitly rather than on route change, so the sheet never
                lingers over the page it navigated to. */}
            <Link href={ROUTES.cart} onClick={() => setOpen(false)}>
              Review inquiry list
            </Link>
          </Button>

          {lines.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                cartActions.clear();
                setOpen(false);
                toast.success(MESSAGES.cart.cleared);
              }}
            >
              Clear list
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

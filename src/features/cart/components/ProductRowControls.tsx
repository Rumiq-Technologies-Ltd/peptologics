"use client";

import { useState } from "react";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { ROUTES } from "@/constants/routes";
import { QuantityStepper } from "@/features/cart/components/QuantityStepper";
import { cartActions, useCartHasHydrated, useCartQuantity } from "@/hooks/useCart";
import { cn } from "@/utils/cn";

/**
 * Add-and-adjust control for a single product.
 *
 * The client leaf that keeps its surroundings server-rendered: a catalog row, the
 * catalog page and the product page all stay Server Components, and only this
 * button ships JavaScript.
 *
 * Subscribes to one number — this product's quantity — so adding a compound
 * re-renders this control and nothing else on a forty-row page.
 *
 * Confirmation is the control itself changing from "Add" to a stepper showing the
 * quantity, plus a polite status message for anyone not watching it happen. A toast
 * per add would be intrusive on a page whose whole purpose is adding several things;
 * toasts are reserved for refusals, which need explaining.
 */
export interface ProductRowControlsProps {
  productId: string;
  /** Used in accessible names and the status message. */
  productName: string;
  /** `row` for dense catalog rows, `block` for the product page's panel. */
  layout?: "row" | "block";
  className?: string;
}

export function ProductRowControls({
  productId,
  productName,
  layout = "row",
  className,
}: ProductRowControlsProps) {
  const quantity = useCartQuantity(productId);
  const hasHydrated = useCartHasHydrated();
  const [status, setStatus] = useState("");

  const isBlock = layout === "block";

  function handleAdd(): void {
    const outcome = cartActions.addItem(productId);

    if (outcome === "line_limit_reached") {
      toast.warning(MESSAGES.cart.limitReached);
      return;
    }

    setStatus(`${productName} added to your inquiry list.`);
  }

  function handleRemove(): void {
    cartActions.removeItem(productId);
    setStatus(`${productName} removed from your inquiry list.`);
  }

  return (
    <div className={cn(isBlock ? "flex flex-col gap-3" : "flex items-center", className)}>
      {quantity === 0 ? (
        <Button
          type="button"
          size={isBlock ? "lg" : "sm"}
          variant={isBlock ? "default" : "outline"}
          className={cn(isBlock ? "w-full" : "min-h-11 sm:min-h-9")}
          /*
           * Disabled until the persisted list has been read. Not cosmetic: a click
           * that lands mid-rehydration is discarded when the stored items are merged
           * in, so the visitor would see their addition vanish.
           */
          disabled={!hasHydrated}
          aria-label={`Add ${productName} to inquiry list`}
          onClick={handleAdd}
        >
          <PlusIcon aria-hidden="true" />
          {isBlock ? "Add to inquiry list" : "Add"}
        </Button>
      ) : (
        <>
          <QuantityStepper
            value={quantity}
            itemLabel={productName}
            disabled={!hasHydrated}
            onChange={(next) => cartActions.setQuantity(productId, next)}
            onRemove={handleRemove}
            className={isBlock ? "justify-between" : undefined}
          />

          {isBlock ? (
            <Button asChild size="lg" className="w-full">
              <Link href={ROUTES.cart}>Review inquiry list</Link>
            </Button>
          ) : null}
        </>
      )}

      <span role="status" aria-live="polite" className="sr-only">
        {status}
      </span>
    </div>
  );
}

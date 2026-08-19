"use client";

import { useState } from "react";
import { CheckCircle2Icon, TagIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { couponDisplayCode, evaluateCoupon } from "@/features/cart/utils/coupon";
import { cartActions, useCartCouponCode } from "@/hooks/useCart";
import { formatCurrencyExact } from "@/utils/formatCurrency";
import { cn } from "@/utils/cn";

/**
 * The coupon entry field.
 *
 * Applied on submit rather than on every keystroke. Live validation would tell the
 * visitor their code is invalid three characters into typing it, which is the classic
 * way to make a working code feel broken.
 *
 * The applied state stores the code, never the discount — the amount is re-derived
 * from the live subtotal on every render, so removing a vial after applying a coupon
 * silently corrects the figure instead of leaving a stale one on screen.
 *
 * A rejected code stays in the input. Clearing it would make the visitor retype
 * something they may have pasted from an email, and they cannot see what was wrong
 * with it if it has vanished.
 */
export interface CouponFieldProps {
  /** Current subtotal in integer cents, for previewing what the code is worth. */
  subtotalCents: number;
  className?: string;
}

export function CouponField({ subtotalCents, className }: CouponFieldProps) {
  const appliedCode = useCartCouponCode();
  const applied = evaluateCoupon(subtotalCents, appliedCode);

  const [draft, setDraft] = useState("");
  const [rejected, setRejected] = useState(false);

  function handleApply(): void {
    const attempt = evaluateCoupon(subtotalCents, draft);

    if (!attempt.coupon) {
      // "empty" is not worth an error message — the button simply does nothing.
      setRejected(attempt.rejection === "unknown");
      return;
    }

    cartActions.setCouponCode(attempt.coupon.code);
    setDraft("");
    setRejected(false);
  }

  function handleRemove(): void {
    cartActions.setCouponCode(null);
    setDraft("");
    setRejected(false);
  }

  if (applied.coupon) {
    return (
      <div
        className={cn(
          "border-success/30 bg-success-bg flex items-center gap-3 rounded-lg border p-3",
          className,
        )}
      >
        <CheckCircle2Icon className="text-success size-4 shrink-0" aria-hidden="true" />

        <div className="min-w-0 flex-1">
          <p className="text-ink-950 text-sm font-semibold">
            {/* The promoted form, so a referral code reads the way it was given out. */}
            {couponDisplayCode(applied.coupon)}
            <span className="text-ink-600 ml-2 font-normal">{applied.coupon.label}</span>
          </p>
          <p className="text-success text-sm font-medium tabular-nums">
            −{formatCurrencyExact(applied.discountCents)} applied
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          aria-label={`Remove coupon ${couponDisplayCode(applied.coupon)}`}
          className="shrink-0"
        >
          <XIcon aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <div className={className}>
      <label htmlFor="coupon-code" className="text-ink-700 flex items-center gap-2 text-sm">
        <TagIcon className="text-ink-500 size-4" aria-hidden="true" />
        Have a coupon code?
      </label>

      <div className="mt-2 flex gap-2">
        <Input
          id="coupon-code"
          name="couponCode"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            // Clear the previous verdict as soon as they change anything, so the error
            // describes what is in the box rather than what used to be.
            if (rejected) setRejected(false);
          }}
          /*
           * Enter applies the coupon instead of submitting the inquiry. This field sits
           * inside the checkout page beside the form; without this, someone pressing
           * Enter after typing a code would send the whole inquiry without it.
           */
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            handleApply();
          }}
          placeholder="Enter code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={rejected || undefined}
          aria-describedby={rejected ? "coupon-error" : undefined}
          className="font-mono uppercase"
        />

        <Button
          type="button"
          variant="outline"
          onClick={handleApply}
          disabled={draft.trim().length === 0}
        >
          Apply
        </Button>
      </div>

      {rejected ? (
        <p id="coupon-error" role="status" className="text-danger mt-2 text-sm">
          That code is not recognised. Check it and try again.
        </p>
      ) : null}
    </div>
  );
}

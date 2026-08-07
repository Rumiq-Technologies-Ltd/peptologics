"use client";

import Link from "next/link";
import { ClipboardListIcon } from "lucide-react";

import { ROUTES } from "@/constants/routes";
import { useCartHasHydrated, useCartUnitCount } from "@/hooks/useCart";

/**
 * Header link to the inquiry list, with a count.
 *
 * A clipboard, not a shopping basket. This site takes no payment and this list is
 * not an order, so the icon should not borrow retail's vocabulary.
 *
 * The count is absolutely positioned, so it enters and leaves without changing the
 * link's box — the header cannot shift when a product is added, at any breakpoint.
 * It stays hidden until the store has rehydrated, because a badge that appears
 * saying "0" and then corrects itself is worse than one that arrives once.
 *
 * The number is `aria-hidden` and carried in the link's accessible name instead, so
 * a screen reader announces "Inquiry list, 3 vials" rather than "Inquiry list 3".
 */
export function CartBadge() {
  const unitCount = useCartUnitCount();
  const hasHydrated = useCartHasHydrated();

  const showCount = hasHydrated && unitCount > 0;

  return (
    <Link
      href={ROUTES.cart}
      aria-label={
        showCount
          ? `Inquiry list, ${unitCount} ${unitCount === 1 ? "vial" : "vials"}`
          : "Inquiry list, empty"
      }
      className="text-ink-700 hover:bg-ink-50 hover:text-ink-950 relative inline-flex size-11 items-center justify-center rounded-md transition-colors sm:size-9"
    >
      <ClipboardListIcon className="size-5" aria-hidden="true" />

      {showCount ? (
        <span
          aria-hidden="true"
          className="bg-brand-800 absolute top-1 right-1 inline-flex min-w-4 items-center justify-center rounded-full px-1 font-mono text-[0.625rem] leading-4 font-semibold text-white sm:top-0 sm:right-0"
        >
          {unitCount > 99 ? "99+" : unitCount}
        </span>
      ) : null}
    </Link>
  );
}

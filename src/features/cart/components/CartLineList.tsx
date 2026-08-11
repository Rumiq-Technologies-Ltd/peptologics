"use client";

import Link from "next/link";

import { ROUTES } from "@/constants/routes";
import { QuantityStepper } from "@/features/cart/components/QuantityStepper";
import type { CartLine } from "@/features/cart/types/cart";
import { ProductImage } from "@/features/products/components/ProductImage";
import { cartActions, useCartHasHydrated } from "@/hooks/useCart";
import { formatCurrency, formatCurrencyExact } from "@/utils/formatCurrency";
import { formatStrengthCompact } from "@/utils/formatStrength";
import { cn } from "@/utils/cn";

/**
 * The list of selected compounds, rendered identically wherever it appears.
 *
 * One component for the desktop summary panel, the mobile drawer and the `/cart`
 * page. Those three surfaces show the same rows with the same controls, so three
 * implementations would be three chances for them to disagree about what a line
 * looks like or what removing one does.
 *
 * `density="detailed"` adds the unit price column that the full page has room for, and
 * a vial thumbnail. The thumbnail is on the full page only, and deliberately: this is
 * the last screen before someone commits to an inquiry, and recognising the vial is a
 * faster confirmation that the right thing is on the list than re-reading the name.
 * The compact panel and the mobile drawer are too narrow to spend that width on.
 */
export interface CartLineListProps {
  lines: readonly CartLine[];
  density?: "compact" | "detailed";
  className?: string;
}

export function CartLineList({ lines, density = "compact", className }: CartLineListProps) {
  const hasHydrated = useCartHasHydrated();
  const isDetailed = density === "detailed";

  return (
    <ul className={cn("divide-ink-100 divide-y", className)}>
      {lines.map((line) => (
        <li
          key={line.product.id}
          className={cn(
            "flex flex-wrap items-center gap-x-4 gap-y-3",
            isDetailed ? "py-5" : "py-4",
          )}
        >
          {isDetailed ? (
            <ProductImage product={line.product} sizes="56px" className="size-14 rounded-md" />
          ) : null}

          <div className="min-w-0 flex-1">
            <Link
              href={ROUTES.product(line.product.slug)}
              className="text-ink-950 hover:text-brand-800 font-semibold underline-offset-4 hover:underline"
            >
              {line.product.name}
            </Link>
            <p className="text-ink-600 mt-0.5 font-mono text-xs">
              {formatStrengthCompact(line.product.strengthMg, line.product.strengthUnit)}/vial
              {isDetailed ? ` · ${formatCurrency(line.product.priceCents)} each` : null}
            </p>
          </div>

          <QuantityStepper
            value={line.quantity}
            itemLabel={line.product.name}
            disabled={!hasHydrated}
            onChange={(next) => cartActions.setQuantity(line.product.id, next)}
            onRemove={() => cartActions.removeItem(line.product.id)}
          />

          <p
            className={cn(
              "text-ink-950 shrink-0 font-mono font-semibold tabular-nums",
              isDetailed ? "w-24 text-right text-base" : "w-20 text-right text-sm",
            )}
          >
            {/*
              Exact cents here, unlike the catalog. A line of three $60 vials reads
              as $180.00 beside a subtotal, where the trailing zeros keep the column
              aligned; the catalog drops them because a single price reads cleaner.
            */}
            {formatCurrencyExact(line.lineTotalCents)}
          </p>
        </li>
      ))}
    </ul>
  );
}

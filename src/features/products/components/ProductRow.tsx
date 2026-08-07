import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import type { Product } from "@/features/products/types/product";
import { ROUTES } from "@/constants/routes";
import { formatCostPerMg, formatCurrency } from "@/utils/formatCurrency";
import { formatStrengthCompact } from "@/utils/formatStrength";
import { cn } from "@/utils/cn";

/**
 * One catalog row.
 *
 * Shared between the home page's featured strip and the full catalog on purpose:
 * reusing the identical row teaches the visitor the catalog's visual language
 * before they reach it, and guarantees the two cannot drift apart.
 *
 * A row, not a card. The differentiator here is comparable data — size, price,
 * cost per milligram — and a table-like row is what makes a column of figures
 * scannable. Cards would hide exactly the comparison the client's own price list
 * leads with.
 *
 * A Server Component. Quantity controls arrive in Phase 4 as a separate client
 * leaf, so this stays free of JavaScript.
 */
export interface ProductRowProps {
  product: Product;
  className?: string;
}

export function ProductRow({ product, className }: ProductRowProps) {
  return (
    <li className={cn("group", className)}>
      <Link
        href={ROUTES.product(product.slug)}
        className="hover:bg-ink-50/70 flex items-center gap-4 px-1 py-4 transition-colors sm:gap-6"
      >
        <div className="min-w-0 flex-1">
          <p className="text-ink-950 group-hover:text-brand-800 truncate font-semibold">
            {product.name}
          </p>
          <p className="text-ink-600 mt-0.5 font-mono text-xs sm:text-sm">
            {formatStrengthCompact(product.strengthMg)}/vial · lyophilized
          </p>
        </div>

        <p className="text-ink-950 shrink-0 font-mono text-base font-semibold sm:text-lg">
          {formatCurrency(product.priceCents)}
        </p>

        {/*
          Cost per milligram is hidden below `sm` — four columns do not fit a phone,
          and price is the more useful of the two at that width. It is always shown
          on the detail page.
        */}
        <p className="text-ink-600 hidden w-24 shrink-0 text-right font-mono text-sm sm:block">
          {product.isBlend ? (
            // For a blend this figure divides price by total milligrams across
            // several peptides, so it is not comparable and would mislead.
            <span className="text-ink-400" title="Not comparable for a multi-peptide blend">
              —
            </span>
          ) : (
            formatCostPerMg(product.costPerMg)
          )}
        </p>

        <ChevronRightIcon
          className="text-ink-300 group-hover:text-brand-600 size-4 shrink-0"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

/**
 * Column headings for a `ProductRow` list. Hidden below `sm`, matching the row's
 * own responsive behaviour.
 */
export function ProductRowHeader() {
  return (
    <div
      className="border-ink-200 text-eyebrow text-ink-500 hidden items-center gap-4 border-b px-1 pb-2 uppercase sm:flex sm:gap-6"
      aria-hidden="true"
    >
      <span className="min-w-0 flex-1">Compound</span>
      <span className="shrink-0">Price</span>
      <span className="w-24 shrink-0 text-right">Cost / mg</span>
      <span className="size-4 shrink-0" />
    </div>
  );
}

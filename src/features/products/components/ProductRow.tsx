import type { ReactNode } from "react";
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
 * Still a Server Component. `controls` is a slot: the catalog passes the client
 * quantity control into it, and nothing else on the page becomes client-side.
 *
 * The link wraps the product name rather than the whole row. A row-wide anchor
 * cannot legally contain a button — nested interactive elements are invalid HTML,
 * unreachable by keyboard in the expected order, and ambiguous to a screen reader.
 * The trade is that the featured strip's rows are no longer clickable edge to edge;
 * the name and the chevron both still lead to the product.
 */
export interface ProductRowProps {
  product: Product;
  /** Quantity control for the catalog. Omitted on the featured strip, which stays JS-free. */
  controls?: ReactNode;
  className?: string;
}

/** Fixed so the column stays aligned whether it holds "Add" or a three-button stepper. */
const CONTROL_COLUMN_CLASSES = "flex w-28 shrink-0 justify-end sm:w-32";

export function ProductRow({ product, controls, className }: ProductRowProps) {
  return (
    <li className={cn("group", className)}>
      <div className="hover:bg-ink-50/70 flex items-center gap-4 rounded-md px-1 py-4 transition-colors sm:gap-6">
        <div className="min-w-0 flex-1">
          <Link
            href={ROUTES.product(product.slug)}
            className="text-ink-950 hover:text-brand-800 block truncate font-semibold underline-offset-4 hover:underline"
          >
            {product.name}
          </Link>
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

        {controls ? (
          <div className={CONTROL_COLUMN_CLASSES}>{controls}</div>
        ) : (
          <Link
            href={ROUTES.product(product.slug)}
            aria-label={`View ${product.name}`}
            className="text-ink-300 hover:text-brand-600 inline-flex size-11 shrink-0 items-center justify-center rounded-md sm:size-8"
          >
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </li>
  );
}

/**
 * Column headings for a `ProductRow` list. Hidden below `sm`, matching the row's
 * own responsive behaviour.
 */
export function ProductRowHeader({ withControls = false }: { withControls?: boolean }) {
  return (
    <div
      className="border-ink-200 text-eyebrow text-ink-500 hidden items-center gap-4 border-b px-1 pb-2 uppercase sm:flex sm:gap-6"
      aria-hidden="true"
    >
      <span className="min-w-0 flex-1">Compound</span>
      <span className="shrink-0">Price</span>
      <span className="w-24 shrink-0 text-right">Cost / mg</span>
      <span className={withControls ? "w-32 shrink-0 text-right" : "size-8 shrink-0"}>
        {withControls ? "Quantity" : null}
      </span>
    </div>
  );
}

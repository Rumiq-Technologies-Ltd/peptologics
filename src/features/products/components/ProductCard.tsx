import type { ReactNode } from "react";
import Link from "next/link";

import { ProductImage } from "@/features/products/components/ProductImage";
import type { Product } from "@/features/products/types/product";
import { ROUTES } from "@/constants/routes";
import {
  formatPresentation,
  hasComparableCostPerMg,
} from "@/features/products/utils/product.display";
import { formatCostPerMg, formatCurrency } from "@/utils/formatCurrency";
import { formatStrengthCompact } from "@/utils/formatStrength";
import { cn } from "@/utils/cn";

/**
 * A product as a card: photograph first, figures under it.
 *
 * The counterpart to `ProductRow`, not a replacement for it, and the split is
 * deliberate. A row is the right shape for **comparing** — a column of prices and
 * cost-per-milligram figures is scannable in a way a grid of cards never is, which is
 * why the catalog keeps rows. A card is the right shape for **recognising**, which is
 * what the home page is for: a visitor who has not yet decided anything is served
 * better by seeing what the product is than by a table they have no basis to read.
 *
 * Worth being honest about what the photograph does and does not do here. Eighteen
 * vials of the same design differ only by their label, so the image is weak as a
 * differentiator between two products — it will not help anyone choose BPC-157 over
 * KPV. What it does is establish that these are real, labelled, documented goods, and
 * let a returning visitor find the one they bought last time by sight. That is worth a
 * card on the home page and worth a thumbnail in the catalog; it is not worth turning
 * the price list into a gallery.
 *
 * Still a Server Component. `controls` is a slot, exactly as on `ProductRow`, so the
 * client quantity control can sit inside a card without the card itself shipping any
 * JavaScript.
 *
 * The whole card is not a link. The name and the image both lead to the product, but
 * a card-wide anchor cannot legally contain the Add button — nested interactive
 * elements are invalid HTML, land in the wrong keyboard order, and are ambiguous to a
 * screen reader.
 */
export interface ProductCardProps {
  product: Product;
  /** Quantity control. Omitted where the surface must stay JavaScript-free. */
  controls?: ReactNode;
  /** Set on the first card only — it is the one likeliest to be the LCP element. */
  preload?: boolean;
  className?: string;
}

export function ProductCard({ product, controls, preload = false, className }: ProductCardProps) {
  const showsCostPerMg = hasComparableCostPerMg(product);

  return (
    <li
      className={cn(
        "group border-ink-200 flex flex-col overflow-hidden rounded-xl border bg-white",
        "hover:border-brand-300 hover:shadow-panel transition-[border-color,box-shadow] duration-200",
        className,
      )}
    >
      <Link
        href={ROUTES.product(product.slug)}
        // Decorative here: the name immediately below is the accessible link to the
        // same place, so announcing this one would read the product out twice.
        tabIndex={-1}
        aria-hidden="true"
        className="block"
      >
        <ProductImage
          product={product}
          // Three-up from lg, two-up from sm, one-up below — matching the grid the
          // home page puts these in.
          sizes="(min-width: 1024px) 26rem, (min-width: 640px) 45vw, 90vw"
          preload={preload}
          className="rounded-none"
          imageClassName="transition-transform duration-300 group-hover:scale-[1.04] motion-reduce:transform-none"
        />
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-ink-950 font-semibold">
          <Link
            href={ROUTES.product(product.slug)}
            className="hover:text-brand-800 underline-offset-4 hover:underline"
          >
            {product.name}
          </Link>
        </h3>

        <p className="text-ink-600 mt-1 font-mono text-xs">
          {formatStrengthCompact(product.strengthMg, product.strengthUnit)}/vial ·{" "}
          {formatPresentation(product)}
        </p>

        {/* `mt-auto` pins the figures and the control to the bottom, so a grid of
            cards with different name lengths still has its prices on one line. */}
        <div className="mt-auto flex items-baseline justify-between gap-3 pt-4">
          <p className="text-ink-950 font-mono text-lg font-semibold">
            {formatCurrency(product.priceCents)}
          </p>

          {showsCostPerMg ? (
            <p className="text-ink-600 font-mono text-xs">{formatCostPerMg(product.costPerMg)}</p>
          ) : null}
        </div>

        {controls ? <div className="mt-4">{controls}</div> : null}
      </div>
    </li>
  );
}

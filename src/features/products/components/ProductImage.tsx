import Image from "next/image";

import { LatticeMark } from "@/components/ui/LatticeMark";
import type { Product } from "@/features/products/types/product";
import { formatStrength } from "@/utils/formatStrength";
import { cn } from "@/utils/cn";

/**
 * A product's vial photograph, in a reserved square well.
 *
 * One component for every surface that shows a vial — card, catalog row, product page,
 * inquiry list — because the four were otherwise going to disagree about aspect ratio,
 * `sizes`, and what to draw when a product has no photograph yet.
 *
 * Three things it settles:
 *
 * **The well is `ink-200`, and that is not decorative.** The supplied renders are shot
 * on a light grey backdrop measuring about #E5E4E4; `ink-200` is #e2e2e4, so the
 * photograph's own background merges into the container instead of sitting on it as a
 * visible tile. The same colour fills the box before the image arrives, so the load
 * reads as the vial appearing rather than a panel changing colour.
 *
 * **Space is reserved by aspect ratio.** The images are square, the well is square, and
 * the box exists in the layout before any image data does — so a catalog of thirteen
 * photographs cannot shift the page as it loads.
 *
 * **`sizes` is required, not optional.** Without it `next/image` assumes the image
 * occupies the full viewport width and ships a needlessly large file to a 64px
 * thumbnail. Each caller knows its own rendered width; making the prop required forces
 * it to say so.
 */
export interface ProductImageProps {
  product: Product;
  /**
   * The rendered width at each breakpoint, as the `sizes` attribute. A thumbnail
   * passes something like `64px`; a full-width card passes a media-query list.
   */
  sizes: string;
  /**
   * Set on the one image most likely to be the largest contentful paint. Off
   * everywhere else, so a catalog of thirteen does not open thirteen eager requests.
   */
  preload?: boolean;
  className?: string;
  /** Extra classes for the `<img>` itself — padding, mostly. */
  imageClassName?: string;
}

export function ProductImage({
  product,
  sizes,
  preload = false,
  className,
  imageClassName,
}: ProductImageProps) {
  return (
    <div
      className={cn(
        "bg-ink-200 relative aspect-square w-full shrink-0 overflow-hidden rounded-lg",
        className,
      )}
    >
      {product.imageUrl ? (
        <Image
          src={product.imageUrl}
          /*
           * Named rather than decorative. The vial is the only place a visitor can
           * see the label, and a screen-reader user is told what the sighted visitor
           * is looking at: the compound and the vial size. The surrounding markup
           * repeats the name in text, so this stays terse rather than duplicating the
           * whole row.
           */
          alt={`${product.name} ${formatStrength(product.strengthMg, product.strengthUnit)} vial`}
          fill
          sizes={sizes}
          preload={preload}
          className={cn("object-contain", imageClassName)}
        />
      ) : (
        /*
         * No photograph yet. The brand glyph rather than a broken-image icon or a
         * grey void — it fills the same box, so a product added before its render is
         * supplied degrades quietly instead of breaking the grid.
         */
        <div className="text-ink-400 absolute inset-0 grid place-items-center">
          <LatticeMark className="size-1/3" />
        </div>
      )}
    </div>
  );
}

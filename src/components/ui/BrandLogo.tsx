import Image from "next/image";

import { SITE_NAME, SITE_TAGLINE } from "@/constants/site";
import { cn } from "@/utils/cn";

/**
 * The logo lockup.
 *
 * Served as an SVG file through `next/image` rather than inlined, because the
 * supplied vector is 42 KB of path data — fine as an HTTP-cached asset, wasteful
 * in every page's JavaScript. For a small tokenised glyph use `LatticeMark`.
 *
 * `public/brand/peptologics-badge.svg` is the supplied vector with its opaque
 * white background rectangle removed, so it composites correctly on the dark
 * footer and inside the disclaimer gate. The original in `public/assets` is
 * untouched.
 */
export interface BrandLogoProps {
  /** Rendered size in px. The badge is square. */
  size?: number;
  /** Show the wordmark beside the badge. */
  withWordmark?: boolean;
  /** Show the tagline under the wordmark. Implies `withWordmark`. */
  withTagline?: boolean;
  /** Inverts the wordmark for dark surfaces. */
  tone?: "light" | "dark";
  className?: string;
  /**
   * Set on the single logo in the initial viewport so the browser fetches it
   * early. In Next 16 `priority` is deprecated in favour of `preload`.
   */
  preload?: boolean;
}

export function BrandLogo({
  size = 40,
  withWordmark = true,
  withTagline = false,
  tone = "light",
  className,
  preload = false,
}: BrandLogoProps) {
  const showWordmark = withWordmark || withTagline;

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/brand/peptologics-badge.svg"
        alt={showWordmark ? "" : SITE_NAME}
        // Decorative when the wordmark beside it already names the brand.
        aria-hidden={showWordmark ? true : undefined}
        width={size}
        height={size}
        preload={preload}
        className="shrink-0"
      />

      {showWordmark ? (
        <span className="inline-flex flex-col justify-center leading-none">
          <span
            className={cn(
              "text-lg font-bold tracking-tight",
              tone === "dark" ? "text-white" : "text-ink-950",
            )}
          >
            {/* "Pepto" blue, "Logics" charcoal — matching the wordmark itself. */}
            <span className={tone === "dark" ? "text-brand-300" : "text-brand-800"}>Pepto</span>
            Logics
            <span
              className={cn(
                "text-sm font-semibold",
                tone === "dark" ? "text-brand-300" : "text-brand-800",
              )}
            >
              .com
            </span>
          </span>

          {withTagline ? (
            <span
              className={cn(
                "text-tagline mt-1 uppercase",
                tone === "dark" ? "text-ink-300" : "text-ink-600",
              )}
            >
              {SITE_TAGLINE}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

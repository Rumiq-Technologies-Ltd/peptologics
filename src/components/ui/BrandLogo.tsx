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
/** The client's mark alone, without the ring or the wordmark. 880×738 as supplied. */
const MARK_ASPECT_RATIO = 880 / 738;

export interface BrandLogoProps {
  /**
   * `badge` is the circular lockup, used on dark surfaces and in the gate.
   * `mark` is the bare molecular glyph the client supplied for the header.
   *
   * `mark` is a JPEG with a white background rather than a transparent SVG, so it
   * belongs only on white surfaces. It also carries no wordmark, which is why it
   * forces `withWordmark` off — the image is the whole logo.
   */
  variant?: "badge" | "mark";
  /** Rendered size in px. Height for `mark`, width and height for the square badge. */
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
  variant = "badge",
  size = 40,
  withWordmark = true,
  withTagline = false,
  tone = "light",
  className,
  preload = false,
}: BrandLogoProps) {
  if (variant === "mark") {
    return (
      <Image
        src="/brand/peptologics-mark.jpeg"
        // The only brand identifier in its container, so it carries the name.
        alt={SITE_NAME}
        width={Math.round(size * MARK_ASPECT_RATIO)}
        height={size}
        preload={preload}
        className={cn("shrink-0", className)}
      />
    );
  }

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

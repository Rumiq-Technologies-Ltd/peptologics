import Image from "next/image";

import { SITE_NAME, SITE_TAGLINE } from "@/constants/site";
import { cn } from "@/utils/cn";

/**
 * The logo lockup: a graphic, optionally with the wordmark beside it.
 *
 * Both graphics are served as files through `next/image` rather than inlined —
 * the supplied vector alone is 42 KB of path data, fine as an HTTP-cached asset
 * and wasteful in every page's JavaScript. For a small tokenised glyph use
 * `LatticeMark`.
 *
 * `variant` chooses the graphic and nothing else. The wordmark is controlled
 * separately, so either graphic can appear with or without it.
 */

/**
 * The client's molecular mark, supplied as a JPEG on white (and, as of the current
 * asset, a background-removed PNG alongside it).
 *
 * `public/brand/peptologics-mark.png` is that source trimmed to its content bounds
 * and downscaled to 240px tall — roughly five times the largest place it is used
 * (44px, in the footer) — so it composites cleanly on the dark footer instead of
 * arriving as a white tile. The originals are untouched in `public/assets`.
 *
 * Regenerating after a new source lands:
 *   sharp(sourcePath).trim().resize({ height: 240 }).png().toFile(
 *     "public/brand/peptologics-mark.png"
 *   )
 * then update `MARK_ASPECT_RATIO` below to the logged output width over 240 — the
 * trim bounds shift with the artwork, so the ratio is not assumed to stay put.
 */
const MARK_SRC = "/brand/peptologics-mark.png";
const MARK_ASPECT_RATIO = 283 / 240;

/** The circular badge lockup: the supplied vector with its white backing removed. */
const BADGE_SRC = "/brand/peptologics-badge.svg";

export interface BrandLogoProps {
  /**
   * Which graphic to show. `mark` is the client's molecular glyph, `badge` the
   * circular lockup. Both carry transparency, so both work on any surface.
   */
  variant?: "badge" | "mark";
  /** Rendered height in px. The badge is square; the mark is slightly wider than tall. */
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
  const showWordmark = withWordmark || withTagline;
  const isMark = variant === "mark";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src={isMark ? MARK_SRC : BADGE_SRC}
        alt={showWordmark ? "" : SITE_NAME}
        // Decorative when the wordmark beside it already names the brand.
        aria-hidden={showWordmark ? true : undefined}
        width={isMark ? Math.round(size * MARK_ASPECT_RATIO) : size}
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
            <span className={tone === "dark" ? "text-brand-800" : "text-brand-800"}>Pepto</span>
            Logics
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

import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

/**
 * Hexagonal icon container.
 *
 * Lifted from the client's price-list poster, where each product row carries a
 * hexagon-framed line icon. Reusing that motif is what visually ties the website
 * back to the printed material, and it gives icons a consistent footprint without
 * the softness of a rounded square.
 *
 * The hexagon is an inline SVG outline rather than a CSS `clip-path`: clip-path
 * would cut the icon inside it, and a border on a clipped element does not render.
 */
export interface HexFrameProps {
  children: ReactNode;
  className?: string;
  /** `light` for white surfaces, `dark` for the inverted band. */
  tone?: "light" | "dark";
}

export function HexFrame({ children, className, tone = "light" }: HexFrameProps) {
  return (
    <span className={cn("relative inline-flex size-10 items-center justify-center", className)}>
      <svg
        viewBox="0 0 40 40"
        className="absolute inset-0 size-full"
        fill="none"
        aria-hidden="true"
      >
        {/* Flat-top hexagon, inset by 1px so the stroke is not clipped. */}
        <path
          d="M11 2.5H29L38 20L29 37.5H11L2 20Z"
          stroke="currentColor"
          strokeWidth={1.5}
          className={tone === "dark" ? "text-brand-300/50" : "text-brand-200"}
        />
      </svg>

      <span
        className={cn(
          "relative flex items-center justify-center",
          tone === "dark" ? "text-brand-300" : "text-brand-800",
        )}
      >
        {children}
      </span>
    </span>
  );
}

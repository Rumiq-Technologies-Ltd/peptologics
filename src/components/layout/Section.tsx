import type { ReactNode } from "react";

import { Container } from "@/components/layout/Container";
import { cn } from "@/utils/cn";

/**
 * A page section with consistent vertical rhythm and one of three surfaces.
 *
 * Centralising this is what keeps spacing predictable between sections — the
 * alternative is every page choosing its own `py-` value and the page developing
 * a limp.
 *
 * `dark` adds the `.on-dark` class, which globals.css uses to lighten the focus
 * ring so it stays visible against a near-black background.
 */
export interface SectionProps {
  children: ReactNode;
  /** `white` default, `muted` for alternating bands, `dark` for the one inverted band. */
  surface?: "white" | "muted" | "dark";
  /** Overlay the lattice texture. Automatically picks the correct variant for the surface. */
  lattice?: boolean;
  /** Tighter vertical padding, for the trust bar and similar strips. */
  compact?: boolean;
  className?: string;
  id?: string;
  /** Renders a plain block instead of a Container-wrapped one. */
  bleed?: boolean;
  "aria-labelledby"?: string;
}

const SURFACE_CLASSES = {
  white: "bg-white text-ink-950",
  muted: "bg-ink-50 text-ink-950 border-y border-ink-200",
  dark: "on-dark bg-ink-950 text-ink-300",
} as const;

export function Section({
  children,
  surface = "white",
  lattice = false,
  compact = false,
  className,
  id,
  bleed = false,
  ...rest
}: SectionProps) {
  const inner = bleed ? children : <Container>{children}</Container>;

  return (
    <section
      id={id}
      className={cn(
        SURFACE_CLASSES[surface],
        compact ? "py-8" : "py-16 sm:py-20 lg:py-24",
        lattice && (surface === "dark" ? "lattice-bg-inverse" : "lattice-bg"),
        className,
      )}
      {...rest}
    >
      {inner}
    </section>
  );
}

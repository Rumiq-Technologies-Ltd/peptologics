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
  /**
   * Fade and rise the section into view as it is scrolled to.
   *
   * Off by default, which is the deliberate direction. Two kinds of section must not
   * animate and a default of `true` would have quietly caught both:
   *
   * - **The first section on a page.** It is above the fold, and on most pages it
   *   holds the `h1` that is the Largest Contentful Paint element. Starting it at
   *   `opacity: 0` defers LCP until an observer has fired, which is a measurable
   *   Lighthouse cost for a decoration nobody scrolled to see.
   * - **Transactional surfaces** — the inquiry list and the checkout. Someone
   *   adjusting a quantity or filling in an address should not have the page moving
   *   underneath them.
   *
   * Adding the attribute costs nothing on its own: it is inert until the pre-paint
   * script arms the CSS, and `ScrollReveal` is what eventually sets `data-revealed`.
   */
  reveal?: boolean;
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
  reveal = false,
  ...rest
}: SectionProps) {
  const inner = bleed ? children : <Container>{children}</Container>;

  return (
    <section
      id={id}
      className={cn(
        SURFACE_CLASSES[surface],
        compact ? "py-8" : "py-10 sm:py-10 lg:py-10",
        lattice && (surface === "dark" ? "lattice-bg-inverse" : "lattice-bg"),
        className,
      )}
      // An attribute rather than a class, so this stays a Server Component and the
      // observer in ScrollReveal has a single selector to find every one of them.
      data-reveal={reveal ? "" : undefined}
      {...rest}
    >
      {inner}
    </section>
  );
}

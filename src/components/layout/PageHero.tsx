import type { ReactNode } from "react";

import { Section } from "@/components/layout/Section";
import { HeroVisual } from "@/features/home/components/HeroVisual";

/**
 * The standard hero for a secondary page: eyebrow, rule, title, lead, and the
 * amino acid beside it.
 *
 * Extracted when the 3D visual moved beyond the home page. Three pages had the same
 * four elements in the same order with the same classes, and adding a second column to
 * each would have triplicated the grid as well — at which point one of them drifts.
 *
 * Deliberately **not** used by the home page. That hero carries two calls to action and
 * a payment notice, splits 7fr/5fr rather than evenly, and its visual is tuned to sit
 * against a much taller block of copy. Folding both into one component would mean a
 * prop for every difference, which is a worse abstraction than two.
 *
 * A Server Component. `HeroVisual` is the only client boundary, exactly as on the home
 * page, so the heading and copy still ship as HTML with no JavaScript attached and the
 * h1 remains the LCP element.
 */
export interface PageHeroProps {
  /** Small uppercase line above the rule. */
  eyebrow: string;
  /** The page's h1. */
  title: ReactNode;
  /** The paragraph under it. */
  lead: ReactNode;
}

export function PageHero({ eyebrow, title, lead }: PageHeroProps) {
  return (
    <Section lattice>
      {/*
        An even split, unlike the home page's 7fr/5fr. These heroes carry a heading and
        one paragraph rather than a heading, a paragraph and two buttons, so the copy
        column needs less room and the model can take more.
      */}
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-eyebrow text-brand-800 uppercase">{eyebrow}</p>
          <div className="brand-rule mt-3 h-0.5 w-24" aria-hidden="true" />

          <h1 className="text-display text-ink-950 mt-6 font-bold">{title}</h1>

          <p className="text-lead text-ink-600 mt-6 max-w-2xl">{lead}</p>
        </div>

        {/*
          Centred on its own row on mobile, where the grid stacks and the model follows
          the text rather than competing with it.

          From `lg`, the visual is sized by the **row**, not the other way round. A fixed
          26rem square made the canvas the tallest thing in the grid on every page, so
          the row height was constant while the copy was not: About's copy came to 399px
          against a 416px row, Contact's to 224px. `items-center` then split Contact's
          192px of slack above and below the paragraph, which read as the header floating
          away from the section below it.

          `self-stretch` plus `h-full w-auto` inverts that — the square takes its height
          from the row and derives its width, so the copy sets the height and there is
          nothing left to centre. The floor stops a genuinely short hero from shrinking
          the model to a thumbnail.

          `lg:max-w-none` and `lg:translate-y-0` undo home-page-specific tuning that would
          otherwise apply here; tailwind-merge resolves both in favour of these, being
          later in the class string.
        */}
        <div className="flex justify-center lg:justify-end lg:self-stretch">
          <HeroVisual className="lg:h-full lg:min-h-72 lg:w-auto lg:max-w-none lg:translate-y-0" />
        </div>
      </div>
    </Section>
  );
}

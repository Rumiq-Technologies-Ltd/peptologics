import Link from "next/link";

import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { SITE_NAME, SITE_TAGLINE } from "@/constants/site";
import { HeroVisual } from "@/features/home/components/HeroVisual";

/**
 * The home page hero.
 *
 * Extracted from `page.tsx` when the 3D visual landed, so the page file orchestrates
 * sections rather than composing one of them inline.
 *
 * A Server Component. The only client code in this section is `HeroVisual`, which is
 * where the WebGL canvas and its lifecycle rules live — the heading, the copy and both
 * calls to action ship as HTML with no JavaScript attached.
 *
 * The LCP element is still text: server-rendered, above the fold, and not inside any
 * client boundary. The canvas is lazy, `ssr: false`, and reserves its own space, so it
 * cannot take that role or shift the layout when it arrives.
 */
export function HeroSection() {
  return (
    <Section lattice>
      {/*
        The split stays 7/5 rather than widening for the enlarged model. Both 6/5 and an
        even split were measured at 1440px and each cost the headline a fourth line, which
        is a poor trade for a decorative visual: the h1 is the LCP element. The model gains
        its size from its own framing instead — see `AminoAcidScene`.
      */}
      <div className="grid items-center gap-12 lg:grid-cols-[7fr_5fr] lg:gap-16">
        <div>
          <p className="text-eyebrow text-brand-800 uppercase">{SITE_TAGLINE}</p>
          <div className="brand-rule mt-3 h-0.5 w-24" aria-hidden="true" />

          <h1 className="text-display text-ink-950 mt-6 font-bold">
            Research-grade peptides, documented lot by lot.
          </h1>

          <p className="text-lead text-ink-600 mt-6 max-w-2xl">
            {SITE_NAME} supplies lyophilized research peptides with lot documentation available on
            request. Compare list pricing and cost per milligram, build an inquiry list, and a
            representative will confirm availability and provide a formal quotation.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={ROUTES.products}>Browse products</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={ROUTES.labTesting}>Lab testing &amp; COAs</Link>
            </Button>
          </div>

          <p className="text-ink-600 mt-6 text-sm">
            No online payment. Every inquiry is reviewed and answered by a representative.
          </p>
        </div>

        {/*
          Centred on its own row on mobile, where the grid stacks and the model follows
          the text rather than competing with it.
        */}
        <div className="flex justify-center lg:justify-end">
          <HeroVisual />
        </div>
      </div>
    </Section>
  );
}

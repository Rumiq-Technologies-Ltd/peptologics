import { TruckIcon } from "lucide-react";

import { SHIPPING_PROMOTION } from "@/constants/site";

/**
 * The promotional strip, at the very top of every page.
 *
 * This space used to carry the research-use-only compliance line. It now carries the
 * shipping offer, at the client's request. The disclosure did not disappear with it:
 * the footer still repeats `COMPLIANCE_NOTICE_LONG` on every page, the disclaimer gate
 * states it before a first-time visitor sees anything, and it remains in the page
 * metadata and on both generated Open Graph images.
 *
 * A marquee rather than static text, because a fixed line in a 32px strip is the most
 * ignored real estate on a page — visitors have learned that band is boilerplate.
 * Motion is what buys attention here, and this is the one place on the site where
 * that trade is worth making.
 *
 * Still a Server Component with no JavaScript: the loop is a CSS animation on a
 * duplicated track. See `.marquee-track` in globals.css for why there are two copies
 * and what happens under `prefers-reduced-motion`.
 */

/**
 * How many copies of the message go in one half of the track.
 *
 * The animation slides by 50% of the track, so the two halves must be identical and
 * each half must be at least as wide as the viewport — otherwise a gap crosses the
 * screen on a wide monitor. Four repeats covers an ultrawide at this text length.
 */
const REPEATS_PER_HALF = 4;

function PromotionRun() {
  return (
    <>
      {Array.from({ length: REPEATS_PER_HALF }, (_, index) => (
        <span key={index} className="flex shrink-0 items-center gap-2.5 px-7">
          <TruckIcon className="size-4 shrink-0 text-white" aria-hidden="true" />
          {SHIPPING_PROMOTION}
          {/* Separator between runs, so the repeats read as a ticker rather than as
              the same sentence accidentally printed twice. */}
          <span className="text-white/40" aria-hidden="true">
            ✦
          </span>
        </span>
      ))}
    </>
  );
}

/*
 * `brand-600` rather than the charcoal this band used to be. Charcoal made the strip
 * read as chrome — the same colour as the compliance boilerplate that lived here
 * before, which is exactly the band visitors have learned to skip. Solid brand blue
 * reads as a message. White on it measures 6.4:1, comfortably past AA.
 */
export function ComplianceStrip() {
  return (
    <div className="bg-brand-600 relative overflow-hidden text-white">
      {/*
        A soft light sweep across the band. Purely decorative, and behind the text
        rather than over it, so it can never reduce contrast on the message.
      */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0"
      />

      {/*
        The message announced once. The visible track is duplicated for the loop, so
        without this a screen reader would read the offer eight times; `aria-hidden`
        on the whole strip plus one accessible copy here keeps it to one.
      */}
      <p className="sr-only">{SHIPPING_PROMOTION}</p>

      <div className="h-strip relative flex items-center" aria-hidden="true">
        {/*
          Explicit size and weight rather than the `text-tagline` token. That token is
          11px at regular weight and is shared with the footer's compliance line, where
          quiet is correct; here the type has to carry an offer across a bright band,
          so it goes up to 12px semibold. Changing the token would have shouted in the
          footer too.
        */}
        <div className="marquee-track text-[0.75rem] font-semibold tracking-[0.14em] uppercase">
          <div className="flex shrink-0 items-center">
            <PromotionRun />
          </div>
          {/* The second half. Identical by construction — see globals.css. */}
          <div className="flex shrink-0 items-center" aria-hidden="true">
            <PromotionRun />
          </div>
        </div>
      </div>
    </div>
  );
}

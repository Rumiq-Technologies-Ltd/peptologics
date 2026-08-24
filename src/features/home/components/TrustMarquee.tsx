"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import {
  FileCheck2Icon,
  FlaskConicalIcon,
  PackageCheckIcon,
  ShieldCheckIcon,
  SnowflakeIcon,
} from "lucide-react";

import { HexFrame } from "@/components/ui/HexFrame";
import {
  cubicBezier,
  rowSlots,
  slotOffset,
  stepDelay,
  wrapSlot,
} from "@/features/home/utils/steppedRow";

/**
 * The trust bar as a stepped row.
 *
 * A rigid stepped marquee, not a constant slide. Every card travels exactly one pitch to
 * the left per cycle, with the same distance, duration and easing; only the start time
 * differs, and that offset is what produces the slight shear during a step before the row
 * settles square again. Nothing else animates — no scale, no opacity, no rotation.
 *
 * The whole loop is one GSAP timeline covering a full deck rotation, so it is seamless and
 * revertible without any imperative per-step scheduling. `.marquee-track` in globals.css
 * cannot express this: a CSS animation resets to its start position on every iteration, so
 * translation cannot accumulate, and the stagger here depends on where a card currently
 * sits rather than on which card it is.
 *
 * This is the page's only client component below the hero. It is a leaf — the section
 * around it stays a Server Component.
 */

/**
 * Process and logistics statements only — no efficacy, therapeutic or outcome claims.
 *
 * Lives here rather than in `page.tsx` because the icons are components, and a Server
 * Component cannot hand a component reference across the client boundary.
 *
 * TODO(client): each of these must be substantiable. "Third-party tested" and "cold-chain
 * handling" in particular are factual assertions about operations. Confirm or soften
 * before launch. Open question 2 in docs/decisions.md.
 */
const TRUST_SIGNALS = [
  {
    icon: FlaskConicalIcon,
    label: "Third-party tested",
    detail: "HPLC and mass spectrometry analysis on production lots.",
  },
  {
    icon: FileCheck2Icon,
    label: "COA on request",
    detail: "Lot-specific Certificate of Analysis for your order.",
  },
  {
    icon: SnowflakeIcon,
    label: "Cold-chain handling",
    detail: "Lyophilized and shipped in temperature-controlled packaging.",
  },
  {
    icon: PackageCheckIcon,
    label: "Sealed and tracked",
    detail: "Tamper-evident packaging with tracked dispatch.",
  },
  {
    icon: ShieldCheckIcon,
    label: "Research use only",
    detail: "Supplied strictly for in-vitro laboratory research.",
  },
] as const;

/**
 * The motion, in one place.
 *
 * `cycle` is how often a step happens and `duration` is how long one takes, so the row is
 * still for `cycle - duration` between steps — that pause is what makes it read as
 * stepped rather than sliding. `stagger` is the gap between neighbouring cards starting.
 */
const ROW = {
  cardWidth: 248,
  gap: 18,
  /** Seconds between steps. */
  cycle: 3,
  /** Seconds one step takes. Must be < cycle. */
  duration: 2.5,
  /** Seconds between adjacent cards starting their step. */
  stagger: 0.045,
  /** Control points for the step's ease. */
  easing: [0.45, 0, 0.15, 1] as const,
} as const;

export function TrustMarquee() {
  const viewportRef = useRef<HTMLDivElement>(null);

  /**
   * Server-rendered at the deck size, then grown to fill the measured frame.
   *
   * It has to start at exactly `TRUST_SIGNALS.length` rather than at a guess: the server
   * has no viewport to measure, and any other number would render markup the first client
   * pass disagrees with. Reduced motion keeps this count, which is why the CSS fallback
   * hides everything past the first pass.
   */
  const [slots, setSlots] = useState<number>(TRUST_SIGNALS.length);

  /** Explicit height for the viewport, since every card is absolutely positioned. */
  const [height, setHeight] = useState<number | null>(null);

  // Slot count and height are both functions of the frame, so they are measured rather
  // than assumed, and re-measured whenever it changes.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const measure = () => {
      const width = viewport.clientWidth || (ROW.cardWidth + ROW.gap) * 3;
      setSlots(Math.max(TRUST_SIGNALS.length, rowSlots(width, ROW)));

      const tallest = [...viewport.querySelectorAll<HTMLElement>(".stepped-row-card")].reduce(
        (max, card) => Math.max(max, card.offsetHeight),
        0,
      );
      if (tallest > 0) setHeight(tallest);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  /*
   * `useLayoutEffect`, not `useEffect`: GSAP writes the rest positions, and doing that
   * after paint would show one frame of every card stacked at x=0.
   */
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const cards = [...viewport.querySelectorAll<HTMLElement>(".stepped-row-card")];
    if (cards.length === 0) return;

    const width = viewport.clientWidth || (ROW.cardWidth + ROW.gap) * 3;
    const count = cards.length;
    const toX = (slot: number) => slotOffset(slot, width, ROW);

    cards.forEach((card, i) => gsap.set(card, { x: toX(i) }));

    // Reduced motion: rest positions are set, nothing is scheduled, and the CSS fallback
    // takes the row back to a static grid.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timeline = gsap.timeline({ repeat: -1, defaults: { ease: cubicBezier(ROW.easing) } });

    /*
     * One step per slot, so the timeline covers a full rotation of the ring and the loop
     * point is identical to the start. Every card gets the same tween every step — same
     * distance, same duration, same ease — and only `at` differs.
     */
    for (let step = 0; step < count; step++) {
      const base = step * ROW.cycle;

      cards.forEach((card, i) => {
        const from = wrapSlot(i - step, count);
        const at = base + stepDelay(from, width, ROW);

        timeline.fromTo(card, { x: toX(from) }, { x: toX(from - 1), duration: ROW.duration }, at);

        // This card has just cleared the frame entirely, so it can be teleported to the
        // far end without ever being seen to jump.
        if (from === 0) timeline.set(card, { x: toX(count - 1) }, at + ROW.duration);
      });
    }

    timeline.duration(count * ROW.cycle);

    return () => void timeline.kill();
  }, [slots, height]);

  return (
    <>
      {/*
        One accessible copy of the list. The row is duplicated to fill a moving frame, so
        without this a screen reader would read all five signals two or three times over;
        `aria-hidden` on the row plus this list keeps it to one.
      */}
      <ul className="sr-only">
        {TRUST_SIGNALS.map(({ label, detail }) => (
          <li key={label}>
            {label}. {detail}
          </li>
        ))}
      </ul>

      <div
        ref={viewportRef}
        aria-hidden="true"
        className="stepped-row marquee-fade"
        style={
          {
            "--stepped-row-card-width": `${ROW.cardWidth}px`,
            "--marquee-fade": "12%",
            height: height ?? undefined,
          } as CSSProperties
        }
      >
        <div className="stepped-row-track absolute inset-0">
          {Array.from({ length: slots }, (_, index) => {
            const { icon: Icon, label, detail } = TRUST_SIGNALS[index % TRUST_SIGNALS.length]!;

            return (
              <div
                key={index}
                className="stepped-row-card"
                // Everything past the first pass exists only to fill the frame, and is
                // dropped by the reduced-motion grid.
                data-clone={index >= TRUST_SIGNALS.length ? "" : undefined}
              >
                <HexFrame>
                  <Icon className="size-5" aria-hidden="true" />
                </HexFrame>
                <p className="text-eyebrow text-ink-950 mt-3 uppercase">{label}</p>
                <p className="text-ink-600 mt-1 text-sm">{detail}</p>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

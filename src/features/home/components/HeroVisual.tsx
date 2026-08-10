"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";

import {
  getAcknowledgementSnapshot,
  getServerAcknowledgementSnapshot,
  subscribeToAcknowledgement,
} from "@/features/disclaimer/acknowledgement";
import { cn } from "@/utils/cn";

/**
 * The hero's 3D visual, and everything that decides when it is allowed to run.
 *
 * Split from the scene itself so `AminoAcidScene` stays a plain three.js component —
 * testable and reusable — while the loading, sizing and lifecycle rules live here.
 *
 * Three separate gates decide whether the render loop runs, and all three have to be
 * open. Each one exists because of a real cost:
 *
 * 1. **On screen.** Below the fold, a spinning canvas is pure battery for nothing.
 * 2. **Tab visible.** A backgrounded tab would otherwise keep the GPU busy.
 * 3. **Disclaimer accepted.** On a first visit the gate covers the page and marks
 *    `#site-root` inert (ADR-009). Animating behind a modal the visitor cannot dismiss
 *    yet is the least useful work the site could possibly do.
 */

/**
 * `ssr: false` is the whole reason this component is a client boundary: WebGL has no
 * server equivalent, and Next only permits the option inside a Client Component.
 *
 * The placeholder is not a spinner. It occupies the exact aspect box the canvas will,
 * so nothing moves when the scene arrives — no layout shift, no blank rectangle.
 */
const AminoAcidScene = dynamic(() => import("@/features/home/components/AminoAcidScene"), {
  ssr: false,
  loading: () => <HeroVisualPlaceholder />,
});

/**
 * A blurred suggestion of the molecule: three soft brand-coloured blooms on the hero's
 * own background. Cheap, and close enough in weight and colour that the swap to the
 * real canvas reads as the image sharpening rather than as content appearing.
 */
function HeroVisualPlaceholder() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-2xl">
      <div className="bg-brand-600/25 absolute top-[18%] left-1/2 size-32 -translate-x-1/2 rounded-full blur-3xl" />
      <div className="bg-ink-950/20 absolute bottom-[28%] left-[24%] size-28 rounded-full blur-3xl" />
      <div className="bg-brand-400/25 absolute right-[20%] bottom-[24%] size-24 rounded-full blur-3xl" />
    </div>
  );
}

export interface HeroVisualProps {
  className?: string;
}

export function HeroVisual({ className }: HeroVisualProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOnScreen, setIsOnScreen] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(true);

  /*
   * The gate's acknowledgement, read through the same external store the gate itself
   * uses. Accepting in another tab releases this one too, for free.
   */
  const hasAcknowledged = useSyncExternalStore(
    subscribeToAcknowledgement,
    getAcknowledgementSnapshot,
    getServerAcknowledgementSnapshot,
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsOnScreen(entry?.isIntersecting ?? false),
      // A little margin, so the loop is already running by the time it scrolls in
      // rather than starting visibly.
      { rootMargin: "120px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function syncVisibility(): void {
      setIsTabVisible(document.visibilityState === "visible");
    }

    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  return (
    <div
      ref={containerRef}
      /*
       * Decorative: the heading and lead already say everything the model conveys, so
       * there is nothing here for a screen reader to miss. Marked on this wrapper rather
       * than on `<Canvas>` — R3F does not forward unknown props to the canvas element,
       * which was verified in the DOM rather than assumed.
       */
      aria-hidden="true"
      className={cn(
        /*
         * A fixed aspect box. The canvas fills it absolutely, so its height is decided
         * before any JavaScript loads and the section cannot resize when it does.
         */
        "relative aspect-square w-full max-w-[32rem] lg:max-w-none",
        /*
         * VERTICAL POSITION — this is the knob.
         *
         * The grid centres the visual against the copy, which sits a little low against
         * the headline. `-translate-y-8` lifts it 2rem. Raise the number to move the model
         * up (`-translate-y-12` = 3rem), lower it to move down, and drop the minus sign to
         * push it below centre (`translate-y-8`).
         *
         * A transform rather than a margin on purpose: it moves only the painted pixels,
         * so the box the grid reserved — and therefore the layout — does not change.
         * Applied from `lg` up, where the visual sits beside the copy; on smaller screens
         * it stacks underneath and centring is already right.
         */
        "lg:-translate-y-14",
        className,
      )}
    >
      <AminoAcidScene active={isOnScreen && isTabVisible && hasAcknowledged} />
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * The one piece of JavaScript behind every scroll animation on the site.
 *
 * Mounted once in the root layout. It renders nothing, holds no state, and owns a
 * single `IntersectionObserver` that watches every `[data-reveal]` element on the
 * page. Server Components opt in by adding an attribute — they do not become Client
 * Components, and no wrapper component sits between them and their markup.
 *
 * Why an observer rather than a scroll handler, and why no animation library:
 *
 * - A `scroll` listener runs on the main thread for every frame of every scroll,
 *   which is exactly the work that shows up as poor INP. `IntersectionObserver`
 *   computes intersections off the main thread and calls back only on a change.
 * - The transition itself is CSS, so it runs on the compositor and keeps going while
 *   the main thread is busy hydrating or fetching. A `requestAnimationFrame` library
 *   would drop those frames.
 * - jQuery, GSAP or Motion would each add more transfer weight than this entire
 *   feature for a fade and a 16px rise.
 *
 * Each element is revealed once and then unobserved. Re-animating on every scroll-by
 * is an interface arguing with its reader.
 */

/** Elements that have not yet been revealed. Revealed ones are unobserved and skipped. */
const REVEAL_SELECTOR = "[data-reveal]:not([data-revealed])";

/**
 * Fraction of the viewport height held back from the bottom before an element counts
 * as arrived. Kept in step with the observer's `rootMargin` below — the setup sweep
 * needs the same line to decide what has already been passed.
 */
const TRIGGER_INSET = 0.2;

function reveal(element: Element): void {
  (element as HTMLElement).dataset.revealed = "";
}

export function ScrollReveal() {
  /*
   * App Router client navigation swaps the DOM without remounting the layout, so a
   * one-shot effect would only ever observe the first page's elements. Keying on the
   * pathname rebuilds the observer for each route.
   */
  const pathname = usePathname();

  useEffect(() => {
    /*
     * The pre-paint script sets this only when motion is wanted. Absent means either
     * reduced-motion or a script that did not run — in both cases nothing is hidden,
     * so there is nothing to reveal and no observer worth creating.
     */
    if (document.documentElement.dataset.motion !== "on") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          /*
           * `isIntersecting` is the ordinary path. The second condition is the safety
           * net, and it is not hypothetical: intersections are only computed on a
           * rendering update, so while the main thread is blocked — the hero's WebGL
           * start-up is the worst offender on this site — no intermediate positions
           * are seen at all. A visitor who scrolls hard through that window has the
           * element pass the trigger line and leave the viewport entirely between two
           * computations, and the first entry we ever receive for it reports
           * `isIntersecting: false`. Watching only the happy path left that content
           * hidden for the rest of the session. Anything already above the fold has
           * been scrolled past and must be shown regardless.
           */
          const scrolledPast = entry.boundingClientRect.bottom <= 0;
          if (!entry.isIntersecting && !scrolledPast) continue;

          reveal(entry.target);
          // Fire once. Nothing re-hides, so continuing to watch is pure cost.
          observer.unobserve(entry.target);
        }
      },
      {
        /*
         * A fifth of the viewport short of the bottom edge, so a section has to be
         * genuinely on screen before it starts moving.
         *
         * This was -10%, which fired the moment an element's top edge crossed 90% of
         * the viewport — while it was still a sliver at the very bottom. The reveal
         * then ran and finished during the scroll that brought it into view, so the
         * section was simply already there by the time it could be looked at. -20%
         * holds it back until roughly a fifth of the viewport sits below its top
         * edge, which is the point at which someone is actually looking at it.
         *
         * The threshold stays near-zero on purpose: requiring a *percentage of the
         * element* would delay any section taller than the viewport until it was
         * half past the fold, which is the opposite problem.
         */
        rootMargin: `0px 0px -${TRIGGER_INSET * 100}% 0px`,
        threshold: 0.01,
      },
    );

    /**
     * Reveals everything currently at or above the trigger line, and reports whether
     * any hidden element is left on the page.
     *
     * Used both for the initial scan and by the backstop below, so "has this arrived
     * yet" has one definition.
     */
    function sweep(): boolean {
      const triggerLine = window.innerHeight * (1 - TRIGGER_INSET);

      for (const element of document.querySelectorAll(REVEAL_SELECTOR)) {
        if (element.getBoundingClientRect().top < triggerLine) reveal(element);
      }

      return document.querySelector(REVEAL_SELECTOR) !== null;
    }

    /*
     * A rAF-throttled backstop on top of the observer.
     *
     * The observer is the efficient path and does the work in every ordinary case.
     * What it cannot promise is convergence: intersections are computed only on a
     * rendering update, so a heavy main thread — the home page's WebGL hero is the
     * one that actually does this — can swallow the window in which an element was
     * intersecting. Measured on a production build, that left five sections hidden
     * for the rest of the session on roughly one cold load in two. Hidden content
     * that never comes back is the one outcome this feature must not have.
     *
     * Passive, so it never delays a scroll, coalesced to one check per frame, and it
     * removes itself the moment nothing on the page is still hidden — which is after
     * a single pass down most routes. The steady-state cost is zero listeners.
     */
    let pending = 0;

    function detach(): void {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    }

    function runSweep(): void {
      pending = 0;
      if (!sweep()) detach();
    }

    function onScrollOrResize(): void {
      if (pending) return;
      pending = requestAnimationFrame(runSweep);
    }

    /*
     * One frame's grace so the incoming route's DOM is committed before the scan.
     * Without it a client navigation observes the outgoing page's elements.
     */
    const frame = requestAnimationFrame(() => {
      /*
       * Anything already above the line has effectively been arrived at — either it
       * is above the fold on a fresh load, or this callback ran late and the visitor
       * has already scrolled past it. Handing those to the observer would only ever
       * produce a non-intersecting entry, leaving them hidden.
       */
      const triggerLine = window.innerHeight * (1 - TRIGGER_INSET);

      for (const element of document.querySelectorAll(REVEAL_SELECTOR)) {
        if (element.getBoundingClientRect().top < triggerLine) {
          reveal(element);
          continue;
        }

        observer.observe(element);
      }

      if (document.querySelector(REVEAL_SELECTOR) !== null) {
        window.addEventListener("scroll", onScrollOrResize, { passive: true });
        window.addEventListener("resize", onScrollOrResize, { passive: true });
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      if (pending) cancelAnimationFrame(pending);
      detach();
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}

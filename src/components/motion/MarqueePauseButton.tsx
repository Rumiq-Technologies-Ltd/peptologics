"use client";

import { useState, type MouseEvent } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";

import { cn } from "@/utils/cn";

/**
 * Stops and restarts the announcement strip above the header (WCAG 2.2.2).
 *
 * A moving message that starts by itself must have a way to stop, whatever the visitor's
 * motion setting. The strip is a Server Component with a CSS loop, so this is the only
 * client code it needs. It does not hold the animation state: it marks the strip, and
 * `globals.css` pauses the track while that mark is present. Reduced motion already shows
 * the strip still, so the control is hidden there.
 */
export function MarqueePauseButton({ className }: { className?: string }) {
  const [isPaused, setIsPaused] = useState(false);

  function toggle(event: MouseEvent<HTMLButtonElement>): void {
    const strip = event.currentTarget.closest("[data-marquee]");
    if (!strip) return;

    const next = !isPaused;
    if (next) strip.setAttribute("data-paused", "");
    else strip.removeAttribute("data-paused");
    setIsPaused(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isPaused ? "Play the announcement" : "Pause the announcement"}
      className={cn(
        "bg-brand-600 hover:bg-brand-700 inline-flex min-h-7 min-w-7 items-center justify-center rounded-full border border-white/60 px-1.5 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:hidden",
        className,
      )}
    >
      {isPaused ? (
        <PlayIcon className="size-3.5" aria-hidden="true" />
      ) : (
        <PauseIcon className="size-3.5" aria-hidden="true" />
      )}
    </button>
  );
}

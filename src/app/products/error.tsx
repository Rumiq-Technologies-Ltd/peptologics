"use client";

import Link from "next/link";

import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { ROUTES } from "@/constants/routes";

/**
 * Catalog error boundary.
 *
 * Next 16 passes `retry`, not `reset` — `retry` re-runs the failed server render,
 * whereas `reset` only re-renders children with the same data and would show the
 * same error again.
 */
export default function ProductsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <Section className="min-h-[55vh]">
      <div className="mx-auto max-w-xl">
        <p className="text-eyebrow text-danger font-mono uppercase">Catalog unavailable</p>
        <h1 className="text-h2 text-ink-950 mt-3 font-bold">{MESSAGES.products.loadFailed}</h1>

        <p className="text-ink-700 mt-4">
          This is on our side, not yours. Try again in a moment — if it keeps happening, contact us
          and we will send you the current list directly.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => retry()}>{MESSAGES.generic.retry}</Button>
          <Button asChild variant="outline">
            <Link href={ROUTES.contact}>Contact us</Link>
          </Button>
        </div>

        {error.digest ? (
          <p className="text-ink-400 mt-10 font-mono text-xs">Reference: {error.digest}</p>
        ) : null}
      </div>
    </Section>
  );
}

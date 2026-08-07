"use client";

import Link from "next/link";

import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { ROUTES } from "@/constants/routes";

/**
 * Site-wide error boundary.
 *
 * Next 16 passes `retry`, not `reset`. `retry` re-runs the failed server render;
 * `reset` only re-renders children with the same data, which would show the same
 * error again.
 *
 * `error.digest` is surfaced deliberately: it is a hash Next logs server-side, so
 * it gives support something to correlate on without exposing the message itself.
 * The message is never shown — it may contain internal detail.
 */
export default function GlobalRouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <Section className="min-h-[55vh]">
      <div className="mx-auto max-w-xl">
        <p className="text-eyebrow text-danger font-mono uppercase">Something went wrong</p>
        <h1 className="text-h2 text-ink-950 mt-3 font-bold">{MESSAGES.generic.error}</h1>

        <p className="text-ink-700 mt-4">
          This is on our side, not yours. Trying again usually resolves it. If it keeps happening,
          contact us and we will help directly.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => retry()}>{MESSAGES.generic.retry}</Button>
          <Button asChild variant="outline">
            <Link href={ROUTES.contact}>Contact us</Link>
          </Button>
        </div>

        {error.digest ? (
          <p className="text-ink-400 mt-10 font-mono text-xs">
            Reference: {error.digest}
            <span className="sr-only">
              Quote this reference if you contact us about this error.
            </span>
          </p>
        ) : null}
      </div>
    </Section>
  );
}

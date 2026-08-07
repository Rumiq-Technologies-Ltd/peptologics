"use client";

import Link from "next/link";

import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { ROUTES } from "@/constants/routes";

/**
 * Inquiry route error boundary.
 *
 * Reassurance first: the visitor's list lives in their own browser, so a failure here
 * has cost them nothing. Without saying that, the natural assumption is that the
 * selection is gone.
 *
 * Next 16 passes `retry`, not `reset` — `retry` re-runs the failed server render,
 * whereas `reset` would re-render the same children with the same failure.
 */
export default function InquiryError({
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
          Your inquiry list is stored in this browser and has not been lost. Try again, or contact
          us directly and a representative will take the details from you.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => retry()}>{MESSAGES.generic.retry}</Button>
          <Button asChild variant="outline">
            <Link href={ROUTES.cart}>Back to your list</Link>
          </Button>
          <Button asChild variant="ghost">
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

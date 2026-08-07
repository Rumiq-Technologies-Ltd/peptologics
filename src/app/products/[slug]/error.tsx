"use client";

import Link from "next/link";

import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { ROUTES } from "@/constants/routes";

/**
 * Product detail error boundary. Next 16 passes `retry`, not `reset`.
 *
 * Only handles unexpected failures — an unknown slug renders not-found.tsx, because
 * the page calls `notFound()` for that case rather than throwing.
 */
export default function ProductError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <Section className="min-h-[55vh]">
      <div className="mx-auto max-w-xl">
        <p className="text-eyebrow text-danger font-mono uppercase">Product unavailable</p>
        <h1 className="text-h2 text-ink-950 mt-3 font-bold">{MESSAGES.products.loadFailed}</h1>

        <p className="text-ink-700 mt-4">
          We could not load this product just now. Try again, or browse the full catalog.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => retry()}>{MESSAGES.generic.retry}</Button>
          <Button asChild variant="outline">
            <Link href={ROUTES.products}>All products</Link>
          </Button>
        </div>

        {error.digest ? (
          <p className="text-ink-400 mt-10 font-mono text-xs">Reference: {error.digest}</p>
        ) : null}
      </div>
    </Section>
  );
}

import Link from "next/link";

import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { ROUTES } from "@/constants/routes";

/**
 * Unknown product slug. Always offers a route back into the catalog rather than a
 * dead end — an out-of-date bookmark or a retired product is the usual cause.
 *
 * This route returns a real HTTP 404, not a soft one; see the `dynamicParams` note
 * in page.tsx.
 */
export default function ProductNotFound() {
  return (
    <Section className="min-h-[55vh]">
      <div className="mx-auto max-w-xl">
        <p className="text-eyebrow text-brand-800 font-mono uppercase">Error 404</p>
        <h1 className="text-h2 text-ink-950 mt-3 font-bold">{MESSAGES.products.notFound}</h1>

        <p className="text-ink-700 mt-4">
          The link may be out of date, or the compound may no longer be listed. If you are looking
          for something specific, ask us — we may be able to source it.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={ROUTES.products}>Browse all products</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={ROUTES.contact}>Ask about a compound</Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}

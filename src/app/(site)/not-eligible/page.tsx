import type { Metadata } from "next";
import Link from "next/link";

import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { MINIMUM_AGE, SITE_NAME } from "@/constants/site";
import { contactEmail } from "@/lib/env.client";

/**
 * Where "Decline and exit" goes.
 *
 * A real page rather than `window.close()` — which silently fails for any tab the
 * script did not open — or `history.back()`, which is unreliable and can loop
 * straight back into the gate.
 *
 * Explicitly noindex: it is a dead end for search, and indexing it would surface
 * an access-denied page for brand queries.
 */
export const metadata: Metadata = {
  title: "Access declined",
  robots: { index: false, follow: false },
};

export default function NotEligiblePage() {
  return (
    <Section className="min-h-[60vh]">
      <div className="mx-auto max-w-xl">
        <p className="text-eyebrow text-ink-600 uppercase">Restricted access</p>
        <h1 className="text-h2 text-ink-950 mt-3 font-bold">Access declined</h1>

        <p className="text-ink-700 mt-4">
          You have not accepted the Research-Use-Only terms, so access to the {SITE_NAME} catalog is
          not available.
        </p>

        <p className="text-ink-700 mt-4">
          Our products are supplied strictly for in-vitro laboratory research. Purchasers must be at
          least {MINIMUM_AGE} and either a qualified researcher or acting on behalf of a licensed
          research institution or business.
        </p>

        <div className="border-ink-200 bg-ink-50 mt-8 rounded-lg border p-5">
          <h2 className="text-ink-950 text-sm font-semibold">
            If you are a research institution or business
          </h2>
          <p className="text-ink-700 mt-2 text-sm">
            Contact us directly and a representative will confirm whether we are able to supply you.
          </p>

          {contactEmail ? (
            <p className="mt-3 text-sm">
              <a
                href={`mailto:${contactEmail}`}
                className="text-brand-600 font-medium underline underline-offset-2"
              >
                {contactEmail}
              </a>
            </p>
          ) : null}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {/* Returning to the home page re-presents the gate, which is correct: a
              decline is not permanent, it is simply "not now". */}
          <Button asChild>
            <Link href={ROUTES.home}>Review the terms again</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={ROUTES.researchUseOnly}>Read the full policy</Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardListIcon, MailIcon } from "lucide-react";

import { PageHero } from "@/components/layout/PageHero";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { HexFrame } from "@/components/ui/HexFrame";
import { ROUTES } from "@/constants/routes";
import { SITE_NAME } from "@/constants/site";
import { contactEmail } from "@/lib/env.client";

/**
 * Contact page.
 *
 * No contact form yet, on purpose. A second form would need its own validation,
 * rate limiting, spam defence and notification path — all of which the inquiry
 * pipeline builds in Phase 5. Adding a throwaway form now would mean two
 * submission paths to maintain and secure. Until then this page routes people to
 * the channels that actually work.
 */
export const metadata: Metadata = {
  title: "Contact",
  description: `Contact ${SITE_NAME} about product availability, lot documentation, or a quotation.`,
  alternates: { canonical: ROUTES.contact },
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Get in touch"
        title="Contact us"
        lead="Questions about availability, vial sizes, or lot documentation are welcome before you order. A representative answers every inquiry personally."
      />

      <Section surface="muted" aria-labelledby="channels-heading">
        <h2 id="channels-heading" className="sr-only">
          Ways to reach us
        </h2>

        <div className="grid gap-6 md:grid-cols-2">
          {/* The primary path: a product list gives us everything needed to quote. */}
          <article className="border-brand-200 flex flex-col rounded-xl border bg-white p-6">
            <HexFrame>
              <ClipboardListIcon className="size-5" aria-hidden="true" />
            </HexFrame>
            <h3 className="text-ink-950 mt-3 font-semibold">Request a quotation</h3>
            <p className="text-ink-600 mt-2 flex-1 text-sm">
              The fastest route. Build a list of the compounds and vial sizes you need and send it
              with your details — we can then quote availability, documentation and shipping in one
              reply.
            </p>
            <Button asChild className="mt-5">
              <Link href={ROUTES.products}>Browse products</Link>
            </Button>
          </article>

          <article className="border-ink-200 flex flex-col rounded-xl border bg-white p-6">
            <HexFrame>
              <MailIcon className="size-5" aria-hidden="true" />
            </HexFrame>
            <h3 className="text-ink-950 mt-3 font-semibold">Email</h3>
            <p className="text-ink-600 mt-2 flex-1 text-sm">
              For questions about documentation, eligibility, or an existing order. Include your
              order number if you have one.
            </p>
            {contactEmail ? (
              <Button asChild variant="outline" className="mt-5">
                <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
              </Button>
            ) : (
              // Rendered rather than hidden, so the channel is not silently missing
              // if the environment variable has not been set yet.
              <p className="text-ink-500 mt-5 text-sm">Email address coming soon.</p>
            )}
          </article>
        </div>
      </Section>

      <Section aria-labelledby="expect-heading">
        <div className="max-w-2xl">
          <h2 id="expect-heading" className="text-h2 text-ink-950 font-bold lg:whitespace-nowrap">
            What we can and cannot help with
          </h2>

          <h3 className="text-ink-950 mt-8 font-semibold">We can help with</h3>
          <ul className="text-ink-700 mt-3 list-disc space-y-2 pl-6">
            <li>Availability, vial sizes and pricing</li>
            <li>Lot-specific Certificates of Analysis</li>
            <li>Storage conditions as stated on the certificate</li>
            <li>Shipping, packaging and tracking</li>
            <li>Whether we are able to supply your institution</li>
          </ul>

          <h3 className="text-ink-950 mt-8 font-semibold">We cannot help with</h3>
          <ul className="text-ink-700 mt-3 list-disc space-y-2 pl-6">
            <li>Dosing, protocols, or administration guidance of any kind</li>
            <li>Medical, clinical, veterinary or nutritional advice</li>
            <li>Reconstitution instructions, diluents, or administration materials</li>
            <li>Any question premised on use in or on humans or animals</li>
          </ul>
          <p className="text-ink-600 mt-4 text-sm">
            {SITE_NAME} is not a pharmacy. These are not questions we decline for policy reasons —
            they fall outside what a research-reagent supplier can properly answer. See our{" "}
            <Link
              href={ROUTES.researchUseOnly}
              className="text-brand-600 font-medium underline underline-offset-2"
            >
              Research-Use-Only Policy
            </Link>
            .
          </p>
        </div>
      </Section>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2Icon, MailIcon } from "lucide-react";

import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { ROUTES } from "@/constants/routes";
import { contactEmail } from "@/lib/env.client";

/**
 * Inquiry confirmation.
 *
 * Dynamic, because it reads the reference from the query string. Nothing sensitive is
 * carried there — an order number is a customer-facing reference, not a credential,
 * and no PII appears in the URL (CLAUDE.md, Security).
 *
 * Email is the only contact channel the site offers or promises (ADR-023).
 */

export const metadata: Metadata = {
  title: "Inquiry Received",
  description: "Your inquiry has been received. A representative will be in touch.",
  robots: { index: false, follow: false },
};

/** `PL-001000`. Anything else is discarded rather than echoed back onto the page. */
const ORDER_NUMBER_PATTERN = /^PL-\d{6}$/;

const NEXT_STEPS = [
  {
    title: "We review availability",
    detail: "A representative checks stock and lot documentation for every compound on your list.",
  },
  {
    title: "We contact you",
    detail: "You will hear from us by email, at the address on your inquiry.",
  },
  {
    title: "You confirm the final total",
    detail:
      "Pricing, shipping and payment are arranged directly with the representative. Nothing was charged on this website.",
  },
] as const;

export default async function InquirySuccessPage(props: PageProps<"/inquiry/success">) {
  const params = await props.searchParams;
  const rawReference = Array.isArray(params.ref) ? params.ref[0] : params.ref;

  /*
   * Validated, not merely escaped. React would escape it safely, but rendering
   * arbitrary query text as "your reference" is its own problem: anyone could hand a
   * visitor a link that shows a fabricated confirmation detail.
   */
  const reference =
    rawReference && ORDER_NUMBER_PATTERN.test(rawReference) ? rawReference : undefined;

  return (
    <Section>
      <div className="mx-auto max-w-2xl">
        <CheckCircle2Icon className="text-success size-10" aria-hidden="true" />

        <h1 className="text-display text-ink-950 mt-6 font-bold">{MESSAGES.inquiry.success}</h1>

        <p className="text-lead text-ink-600 mt-4">{MESSAGES.inquiry.successDetail}</p>

        {reference ? (
          <div className="border-ink-200 bg-ink-50 mt-8 rounded-xl border p-5">
            <p className="text-eyebrow text-ink-500 uppercase">Your reference</p>
            <p className="text-ink-950 mt-1 font-mono text-2xl font-bold">{reference}</p>
            <p className="text-ink-600 mt-2 text-sm">
              Quote this if you contact us before we reach you.
            </p>
          </div>
        ) : null}

        <h2 className="text-h3 text-ink-950 mt-12 font-semibold">What happens next</h2>
        <ol className="mt-4 flex flex-col gap-4">
          {NEXT_STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span
                aria-hidden="true"
                className="bg-brand-800 mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-sm font-semibold text-white"
              >
                {index + 1}
              </span>
              <div>
                <p className="text-ink-950 font-semibold">{step.title}</p>
                <p className="text-ink-700 mt-0.5 text-sm">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="border-ink-200 mt-12 flex flex-col gap-3 border-t pt-8 sm:flex-row">
          {contactEmail ? (
            <Button asChild size="lg">
              <a href={`mailto:${contactEmail}`}>
                <MailIcon aria-hidden="true" />
                Email us
              </a>
            </Button>
          ) : null}

          <Button asChild size="lg" variant="ghost">
            <Link href={ROUTES.products}>Back to the catalog</Link>
          </Button>
        </div>

        {!contactEmail ? (
          <p className="text-ink-600 mt-6 text-sm">
            Our direct contact details are being finalised. Your inquiry has been received and a
            representative will reach out by email.
          </p>
        ) : null}
      </div>
    </Section>
  );
}

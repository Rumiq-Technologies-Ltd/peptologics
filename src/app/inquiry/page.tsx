import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheckIcon } from "lucide-react";

import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { ROUTES } from "@/constants/routes";
import { COMPLIANCE_NOTICE_LONG } from "@/constants/site";
import { InquiryForm } from "@/features/inquiry/components/InquiryForm";
import { InquirySummary } from "@/features/inquiry/components/InquirySummary";
import { getContainer } from "@/services/container";

/**
 * The inquiry form page.
 *
 * A Server Component that reads the active catalog and passes it to both client
 * leaves. The persisted list holds product IDs only, so this read is what resolves it
 * — and it means the prices on screen are the same ones the server will price the
 * order from moments later (ADR-020).
 *
 * No route-level `loading.tsx`: the page is prerendered, so nothing server-side is
 * waited on, and a fallback on a prerendered route is never replaced (ADR-017). The
 * one genuine wait is reading `localStorage`, which the summary covers itself.
 */

/** One hour. Must be a literal — see the note in ../products/page.tsx (ADR-015). */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Request a Quotation",
  description:
    "Send your inquiry list to PeptoLogics and a representative will confirm availability, lot documentation and final pricing. No payment is taken on this website.",
  alternates: { canonical: ROUTES.inquiry },
  // A per-visitor working surface with nothing to index, and a crawler carries no
  // inquiry list to fill it with.
  robots: { index: false, follow: true },
};

export default async function InquiryPage() {
  const result = await getContainer().products.listActive();

  if (!result.success) {
    return (
      <Section>
        <h1 className="text-display text-ink-950 font-bold">Request a quotation</h1>
        <div className="border-ink-200 mt-10 rounded-xl border bg-white p-8">
          <p className="text-ink-950 font-semibold">{MESSAGES.products.loadFailed}</p>
          <p className="text-ink-600 mt-1 text-sm">
            Your selection is saved on this device. Please try again in a moment.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link href={ROUTES.cart}>Back to your inquiry list</Link>
          </Button>
        </div>
      </Section>
    );
  }

  return (
    <Section>
      <p className="text-eyebrow text-brand-800 uppercase">Step 2 of 2</p>
      <div className="brand-rule mt-3 h-0.5 w-24" aria-hidden="true" />

      <h1 className="text-display text-ink-950 mt-6 font-bold">Request a quotation</h1>

      <p className="text-lead text-ink-600 mt-5 max-w-2xl">
        Tell us where to reach you. A representative confirms availability, lot documentation and
        final pricing — no payment is taken on this website.
      </p>

      <div className="mt-12 grid gap-10 lg:grid-cols-[7fr_4fr] lg:gap-12">
        <div className="border-ink-200 shadow-panel rounded-xl border bg-white p-5 sm:p-8">
          <InquiryForm catalog={result.data} />
        </div>

        <div className="flex flex-col gap-6">
          <InquirySummary catalog={result.data} />

          <div className="border-brand-200 bg-brand-50 rounded-xl border p-5">
            <ShieldCheckIcon className="text-brand-800 size-5" aria-hidden="true" />
            <p className="text-ink-950 mt-2 text-sm font-semibold">Research use only</p>
            <p className="text-ink-700 mt-2 text-sm">{COMPLIANCE_NOTICE_LONG}</p>
          </div>
        </div>
      </div>
    </Section>
  );
}

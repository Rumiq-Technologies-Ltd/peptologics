import type { Metadata } from "next";
import Link from "next/link";
import { FileCheck2Icon, FlaskConicalIcon, SnowflakeIcon } from "lucide-react";

import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { HexFrame } from "@/components/ui/HexFrame";
import { ROUTES } from "@/constants/routes";
import { SITE_NAME } from "@/constants/site";

/**
 * Lab testing and Certificate of Analysis information.
 *
 * Describes the analytical panel and what a COA does and does not cover. No purity
 * percentage is quoted anywhere, deliberately — that is a substantiable numeric
 * claim and the client has not supplied supporting data.
 *
 * TODO(client): a COA library is not built. Whether COAs exist per product or per
 * lot, and where they are hosted, is open question 10 in docs/decisions.md. When
 * answered, this page becomes the natural home for a downloadable library.
 */
export const metadata: Metadata = {
  title: "Lab Testing & COAs",
  description: `How ${SITE_NAME} analyzes production lots by HPLC and mass spectrometry, and how to request a lot-specific Certificate of Analysis.`,
  alternates: { canonical: ROUTES.labTesting },
};

const PANEL = [
  {
    icon: FlaskConicalIcon,
    title: "Purity by HPLC",
    detail:
      "High-performance liquid chromatography separates the target peptide from related substances, so purity is measured rather than asserted.",
  },
  {
    icon: FileCheck2Icon,
    title: "Identity by mass spectrometry",
    detail:
      "Mass spectrometry confirms the molecular mass matches the expected sequence — that the vial contains what the label says.",
  },
  {
    icon: SnowflakeIcon,
    title: "Handling and storage",
    detail:
      "Storage conditions for the specific lot are stated on its Certificate of Analysis, because they are what keeps the material usable.",
  },
] as const;

export default function LabTestingPage() {
  return (
    <>
      <Section lattice>
        <p className="text-eyebrow text-brand-800 uppercase">Analytical standards</p>
        <div className="brand-rule mt-3 h-0.5 w-24" aria-hidden="true" />

        <h1 className="text-display text-ink-950 mt-6 max-w-3xl font-bold">
          Lab testing and Certificates of Analysis
        </h1>

        <p className="text-lead text-ink-600 mt-6 max-w-2xl">
          A vial is only as good as the paperwork that describes it. Production lots are analyzed
          for purity and identity, and the results are recorded on a lot-specific Certificate of
          Analysis available on request.
        </p>
      </Section>

      <Section surface="muted" aria-labelledby="panel-heading">
        <h2 id="panel-heading" className="text-h2 text-ink-950 font-bold">
          The analytical panel
        </h2>

        <ul className="mt-10 grid gap-8 md:grid-cols-3">
          {PANEL.map(({ icon: Icon, title, detail }) => (
            <li key={title}>
              <HexFrame>
                <Icon className="size-5" aria-hidden="true" />
              </HexFrame>
              <h3 className="text-ink-950 mt-3 font-semibold">{title}</h3>
              <p className="text-ink-600 mt-2 text-sm">{detail}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section aria-labelledby="coa-heading">
        <div className="grid gap-12 lg:grid-cols-[7fr_5fr] lg:gap-16">
          <div>
            <h2 id="coa-heading" className="text-h2 text-ink-950 font-bold">
              What a Certificate of Analysis covers
            </h2>

            <p className="text-ink-700 mt-4">
              A Certificate of Analysis reports the analytical results for one identified production
              lot. It typically states the compound, the lot reference, the analytical methods used,
              the results obtained, and the recommended storage conditions.
            </p>

            <div className="border-brand-800 bg-brand-50 mt-6 rounded-lg border-l-2 p-5">
              <p className="text-ink-950 text-sm font-semibold">
                A COA applies only to the lot it identifies.
              </p>
              <p className="text-ink-700 mt-2 text-sm">
                It is not a general statement about the compound, and it is not transferable to a
                different lot. If you need documentation for the material you actually received, ask
                for the COA matching your lot reference. Independent verification remains the
                responsibility of the purchaser.
              </p>
            </div>

            <h2 className="text-h2 text-ink-950 mt-12 font-bold">Requesting a COA</h2>
            <p className="text-ink-700 mt-4">
              Ask when you submit an inquiry, or contact us with your order number and lot reference
              and we will send the matching certificate.
            </p>

            {/* Honest about the current state rather than implying a library exists. */}
            <p className="text-ink-600 mt-4 text-sm">
              A searchable COA library is not yet published on this site. In the meantime a
              representative will provide documentation directly.
            </p>
          </div>

          <aside className="border-ink-200 bg-ink-50 rounded-xl border p-6">
            <h2 className="text-h3 text-ink-950 font-semibold">What we do not claim</h2>
            <p className="text-ink-700 mt-3 text-sm">
              We do not publish a headline purity figure on this page. A percentage is a specific,
              testable claim, and the honest place for it is the certificate for your lot — not
              marketing materials that cannot be tied to the vial in your hand.
            </p>
            <p className="text-ink-700 mt-3 text-sm">
              Analytical results describe chemical composition. They say nothing about suitability
              for any use, and no result should be read as endorsing use in or on humans or animals.
            </p>
            <Link
              href={ROUTES.researchUseOnly}
              className="text-brand-600 mt-4 inline-flex text-sm font-medium underline underline-offset-2"
            >
              Research-Use-Only Policy
            </Link>
          </aside>
        </div>
      </Section>

      <Section surface="muted">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-h2 text-ink-950 font-bold">Ask about documentation</h2>
          <p className="text-ink-600 mt-4">
            Tell us which compound you need and we will confirm what analytical documentation is
            available before you commit.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href={ROUTES.contact}>Contact us</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={ROUTES.products}>Browse products</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}

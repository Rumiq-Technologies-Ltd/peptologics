import type { Metadata } from "next";
import Link from "next/link";
import { FileCheck2Icon, FlaskConicalIcon, SnowflakeIcon } from "lucide-react";

import { PageHero } from "@/components/layout/PageHero";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { HexFrame } from "@/components/ui/HexFrame";
import { ROUTES } from "@/constants/routes";
import { SITE_NAME } from "@/constants/site";
import { CoaLibrary } from "@/features/products/components/CoaLibrary";
import { getContainer } from "@/services/container";

/**
 * Lab testing and Certificate of Analysis information.
 *
 * Describes the analytical panel and what a COA does and does not cover. No purity
 * percentage is quoted anywhere, deliberately — that is a substantiable numeric
 * claim and the client has not supplied supporting data.
 *
 * The certificate library reads `products.coa_url` from the catalog, so publishing one
 * is a file plus a database update — never a code change. Products without a
 * certificate are absent from the list rather than offering a button that goes nowhere.
 */
/** One hour, matching the catalog. Must be a literal — see ../products/page.tsx (ADR-015). */
export const revalidate = 3600;

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

export default async function LabTestingPage() {
  // Server-read, like every other catalog surface. Only the dialog is client-side.
  const catalog = await getContainer().products.listActive();
  const products = catalog.success ? catalog.data : [];
  return (
    <>
      <PageHero
        eyebrow="Analytical standards"
        title="Lab testing and Certificates of Analysis"
        lead="A vial is only as good as the paperwork that describes it. Production lots are analyzed for purity and identity, and the results are recorded on a lot-specific Certificate of Analysis available on request."
      />

      <Section surface="muted" reveal aria-labelledby="panel-heading">
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

      <Section reveal aria-labelledby="coa-heading">
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

            <h2 className="text-h2 text-ink-950 mt-12 font-bold">Published certificates</h2>
            <p className="text-ink-700 mt-4">
              The certificates below are published for the compounds we currently hold documentation
              for. Each one applies only to the lot it identifies.
            </p>

            <div className="mt-6">
              <CoaLibrary products={products} />
            </div>
          </div>

          {/*
            `self-start` is what stops these stretching. A grid item defaults to
            `align-items: stretch`, so the panel used to grow to the full height of the
            certificate list beside it and ended in a long empty tail. Aligning to the
            start makes each box exactly as tall as its own content.

            Two boxes rather than one: they say different things. The first is a
            disclaimer about what the certificates do not assert; the second is an
            action. Sharing a border implied the second was part of the caveat.
          */}
          <div className="flex flex-col gap-6 self-start">
            <aside className="border-ink-200 bg-ink-50 rounded-xl border p-6">
              <h2 className="text-h3 text-ink-950 font-semibold">What we do not claim</h2>
              <p className="text-ink-700 mt-3 text-sm">
                We do not publish a headline purity figure on this page. A percentage is a specific,
                testable claim, and the honest place for it is the certificate for your lot — not
                marketing materials that cannot be tied to the vial in your hand.
              </p>
              <p className="text-ink-700 mt-3 text-sm">
                Analytical results describe chemical composition. They say nothing about suitability
                for any use, and no result should be read as endorsing use in or on humans or
                animals.
              </p>
              <Link
                href={ROUTES.researchUseOnly}
                className="text-brand-600 mt-4 inline-flex text-sm font-medium underline underline-offset-2"
              >
                Research-Use-Only Policy
              </Link>
            </aside>

            {/*
              Moved out of the left column, where it sat under the certificate list as
              an h3. It is a heading of the same rank as the panel above it now, so it
              takes h2 — the visual size is unchanged, only the level.
            */}
            <aside className="border-ink-200 bg-ink-50 rounded-xl border p-6 lg:mt-16">
              <h2 className="text-h3 text-ink-950 font-semibold">Requesting another</h2>
              <p className="text-ink-700 mt-3 text-sm">
                For a compound not listed, or for the certificate matching the specific lot you
                receive, ask when you submit an inquiry or contact us with your order number and we
                will send it directly.
              </p>
            </aside>
          </div>
        </div>
      </Section>

      <Section surface="muted" reveal>
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

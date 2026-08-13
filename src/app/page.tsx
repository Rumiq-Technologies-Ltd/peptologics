import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  FileCheck2Icon,
  FlaskConicalIcon,
  PackageCheckIcon,
  ShieldCheckIcon,
  SnowflakeIcon,
} from "lucide-react";

import { Section } from "@/components/layout/Section";
import { JsonLd } from "@/components/shared/JsonLd";
import { Button } from "@/components/ui/button";
import { HexFrame } from "@/components/ui/HexFrame";
import { ProductRowControls } from "@/features/cart/components/ProductRowControls";
import { HeroSection } from "@/features/home/components/HeroSection";
import { ProductCard } from "@/features/products/components/ProductCard";
import { ROUTES } from "@/constants/routes";
import { SITE_NAME, SITE_TAGLINE } from "@/constants/site";
import { buildFaqSchema } from "@/lib/seo/structuredData";
import { getContainer } from "@/services/container";

/** One hour. Must be a literal — see the note in products/page.tsx. */
export const revalidate = 3600;

export const metadata: Metadata = {
  // `absolute` so home reads as the brand rather than being run through the
  // "%s | PeptoLogics" template defined in the root layout.
  title: { absolute: `${SITE_NAME} — ${SITE_TAGLINE}` },
  alternates: { canonical: ROUTES.home },
};

/**
 * Process and logistics statements only — no efficacy, therapeutic or outcome
 * claims anywhere on this page.
 *
 * TODO(client): each of these must be substantiable. "Third-party tested" and
 * "cold-chain handling" in particular are factual assertions about operations.
 * Confirm or soften before launch. Open question 2 in docs/decisions.md.
 */
const TRUST_SIGNALS = [
  {
    icon: FlaskConicalIcon,
    label: "Third-party tested",
    detail: "HPLC and mass spectrometry analysis on production lots.",
  },
  {
    icon: FileCheck2Icon,
    label: "COA on request",
    detail: "Lot-specific Certificate of Analysis for your order.",
  },
  {
    icon: SnowflakeIcon,
    label: "Cold-chain handling",
    detail: "Lyophilized and shipped in temperature-controlled packaging.",
  },
  {
    icon: PackageCheckIcon,
    label: "Sealed and tracked",
    detail: "Tamper-evident packaging with tracked dispatch.",
  },
  {
    icon: ShieldCheckIcon,
    label: "Research use only",
    detail: "Supplied strictly for in-vitro laboratory research.",
  },
] as const;

const PROCESS_STEPS = [
  {
    title: "Build your list",
    detail:
      "Select compounds and vial sizes. Pricing shown is indicative list pricing, with cost per milligram so you can compare across sizes.",
  },
  {
    title: "Submit an inquiry",
    detail:
      "Send us your list with your contact and shipping details. No payment is taken on this website.",
  },
  {
    title: "Receive a quotation",
    detail: "A representative confirms availability, lot documentation and final pricing by email.",
  },
  {
    title: "Dispatch",
    detail: "Once you approve the quotation, your order is packed and dispatched with tracking.",
  },
] as const;

const FAQS = [
  {
    question: "Are these products for human use?",
    answer:
      "No. They are supplied for in-vitro laboratory research only, are not approved by the FDA or any comparable authority for therapeutic use, and must not be administered to humans or animals.",
  },
  {
    question: "Do you provide dosing or administration guidance?",
    answer:
      "No. We are not a pharmacy and do not provide dosing information, protocols, or medical advice. We do not supply diluents, syringes, or other administration materials.",
  },
  {
    question: "How do I order if the website does not take payment?",
    answer:
      "Build an inquiry list and submit it. A representative confirms availability and final pricing, then arranges payment and dispatch with you directly.",
  },
  {
    question: "Can I see a Certificate of Analysis before ordering?",
    answer:
      "Ask and we will provide the lot-specific Certificate of Analysis for your order. A COA applies only to the lot it identifies.",
  },
  {
    question: "What is cost per milligram, and why do you show it?",
    answer:
      "It is the vial price divided by the milligrams it contains. It lets you compare value across vial sizes, since larger vials are often lower per milligram. We do not show it for multi-peptide blends, where the figure is not comparable.",
  },
  {
    question: "How are products supplied and stored?",
    answer:
      "As lyophilized powder in sealed vials. Storage conditions are stated on the Certificate of Analysis. Shipments use temperature-controlled packaging.",
  },
  {
    question: "Who are you able to supply?",
    answer:
      "Purchasers must be at least 21 and either a qualified researcher or acting for a licensed institution or business. You are responsible for licensing and compliance in your jurisdiction.",
  },
  {
    question: "How is my information used?",
    answer:
      "Only to respond to your inquiry and fulfil an order. We do not sell your data. See our Privacy Policy.",
  },
] as const;

export default async function HomePage() {
  const featured = await getContainer().products.listFeatured();
  const products = featured.success ? featured.data : [];

  return (
    <>
      {/*
        FAQPage built from the same array the section below renders, so the markup
        cannot describe an answer the page does not show — the mismatch Google's
        structured-data policy treats as spam.
      */}
      <JsonLd schema={buildFaqSchema(FAQS)} />

      <HeroSection />

      {/* ---------------------------------------------------------- Trust bar */}
      {/*
        The band itself does not reveal — its only non-item child is an `sr-only`
        heading, so animating the wrapper would fade in an empty box and then stagger
        its contents inside it. The signals carry the motion on their own.
      */}
      <Section surface="muted" compact aria-labelledby="trust-heading">
        <h2 id="trust-heading" className="sr-only">
          How we supply
        </h2>
        <ul className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-5">
          {TRUST_SIGNALS.map(({ icon: Icon, label, detail }, index) => (
            /*
              Each signal arrives 60ms after the one before it, so the row reads
              left-to-right rather than flashing as one block. `--reveal-index` is set
              on the item itself, not inherited from the list: driving a child's
              transform from a parent variable restyles every sibling on each frame.
            */
            <li key={label} data-reveal style={{ "--reveal-index": index } as CSSProperties}>
              <HexFrame>
                <Icon className="size-5" aria-hidden="true" />
              </HexFrame>
              <p className="text-eyebrow text-ink-950 mt-3 uppercase">{label}</p>
              <p className="text-ink-600 mt-1 text-sm">{detail}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* -------------------------------------------------- Featured products */}
      {products.length > 0 ? (
        <Section reveal aria-labelledby="catalog-heading">
          <p className="text-eyebrow text-brand-800 uppercase">Catalog</p>
          <h2 id="catalog-heading" className="text-h2 text-ink-950 mt-3 font-bold">
            Frequently requested compounds
          </h2>
          <p className="text-ink-600 mt-3 max-w-2xl">
            Indicative list pricing with cost per milligram, so value is comparable across vial
            sizes.
          </p>

          {/*
            Cards here, rows on the catalog. This is the discovery surface — a visitor
            who has decided nothing yet is served by seeing what the product is, where
            a table of figures gives them nothing to compare against.

            Each card carries its own Add control, and that is the point of the change
            rather than a detail of it: reaching an inquiry from this page used to mean
            card, product page, add, review. It now means add, review. One navigation
            removed from the shortest path on the site.
          */}
          {/*
            Three across, not four. There are five featured products, and a four-column
            grid leaves the fifth alone on its own row looking like a mistake; three
            wraps to 3 + 2, which reads as a grid rather than an orphan. Revisit if the
            client features a multiple of four.
          */}
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                /*
                  No `preload` on any of these, deliberately. They sit well below the
                  fold — the LCP element on this page is the hero heading, and the hero
                  also lazy-loads a WebGL canvas. Preloading a card image here does not
                  make it arrive sooner than the visitor scrolls to it; it just competes
                  with the two things above it that do matter.
                */
                controls={
                  <ProductRowControls
                    productId={product.id}
                    productName={product.name}
                    layout="card"
                  />
                }
              />
            ))}
          </ul>

          <Button asChild variant="outline" className="mt-8">
            <Link href={ROUTES.products}>View all products</Link>
          </Button>
        </Section>
      ) : null}

      {/* ------------------------------------------------------- How it works */}
      <Section surface="muted" reveal aria-labelledby="process-heading">
        <p className="text-eyebrow text-brand-800 uppercase">Process</p>
        <h2 id="process-heading" className="text-h2 text-ink-950 mt-3 font-bold">
          From inquiry to dispatch in four steps
        </h2>

        <ol className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {PROCESS_STEPS.map((step, index) => (
            <li key={step.title}>
              <p className="text-h3 text-ink-300 font-mono font-semibold" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="text-ink-950 mt-2 font-semibold">{step.title}</h3>
              <p className="text-ink-600 mt-2 text-sm">{step.detail}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ----------------------------------------- Analytical standards (dark) */}
      <Section surface="dark" lattice reveal aria-labelledby="standards-heading">
        <p className="text-eyebrow text-brand-300 uppercase">Analytical standards</p>
        <h2 id="standards-heading" className="text-h2 mt-3 max-w-3xl font-bold text-white">
          Lot documentation, available on request
        </h2>

        <p className="text-ink-300 mt-5 max-w-2xl">
          Production lots are analyzed by high-performance liquid chromatography for purity and by
          mass spectrometry for identity. Results are recorded on a lot-specific Certificate of
          Analysis.
        </p>

        {/*
          Non-numeric deliberately. A figure like "≥99% purity" is a substantiable
          claim the client must be able to evidence; these state what is done, not
          what result is guaranteed. Open question 2.
        */}
        <dl className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            { figure: "HPLC + MS", label: "Standard analytical panel" },
            { figure: "Per lot", label: "Certificate of Analysis" },
            { figure: "Lyophilized", label: "Supplied as sealed powder" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-white/15 bg-white/[0.06] p-5">
              <dt className="text-h3 font-mono font-semibold text-white">{stat.figure}</dt>
              <dd className="text-ink-300 mt-1 text-sm">{stat.label}</dd>
            </div>
          ))}
        </dl>

        <Button asChild variant="secondary" className="mt-8">
          <Link href={ROUTES.labTesting}>About our testing</Link>
        </Button>
      </Section>

      {/* ---------------------------------------------------------------- FAQ */}
      <Section reveal aria-labelledby="faq-heading">
        <p className="text-eyebrow text-brand-800 uppercase">Questions</p>
        <h2 id="faq-heading" className="text-h2 text-ink-950 mt-3 font-bold">
          Frequently asked questions
        </h2>

        {/*
          Native <details> sharing a `name`, so only one opens at a time. Zero
          JavaScript, keyboard accessible for free, and it keeps this section a
          Server Component — an Accordion component would not.
        */}
        <div className="divide-ink-200 border-ink-200 mt-8 max-w-3xl divide-y border-y">
          {FAQS.map((faq) => (
            <details key={faq.question} name="faq" className="group py-4">
              <summary className="text-ink-950 flex cursor-pointer items-center justify-between gap-4 font-medium marker:content-none">
                <h3 className="text-base">{faq.question}</h3>
                <span
                  className="text-brand-800 shrink-0 font-mono text-lg transition-transform group-open:rotate-45"
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <p className="text-ink-600 mt-3 max-w-prose text-sm">{faq.answer}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------- Final CTA */}
      <Section surface="muted" reveal>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-h2 text-ink-950 font-bold">Ready to request a quotation?</h2>
          <p className="text-ink-600 mt-4">
            Build your list, send it over, and a representative will confirm availability, lot
            documentation and final pricing.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href={ROUTES.products}>Browse products</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={ROUTES.contact}>Contact us</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}

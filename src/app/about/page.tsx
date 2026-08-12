import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheckIcon } from "lucide-react";

import { PageHero } from "@/components/layout/PageHero";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { SITE_NAME, SITE_TAGLINE } from "@/constants/site";

export const metadata: Metadata = {
  title: "About",
  description: `${SITE_NAME} supplies lyophilized research peptides to research institutions, contract research organisations, and qualified independent researchers. For laboratory research use only.`,
  alternates: { canonical: ROUTES.about },
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow={SITE_TAGLINE}
        title="A supplier built around documentation"
        lead={
          <>
            {SITE_NAME} supplies lyophilized research peptides for in-vitro laboratory work. Our
            proposition is not a wider catalog than anyone else&apos;s — it is that you can see what
            you are buying, compare it honestly, and get the paperwork for the lot you received.
          </>
        }
      />

      <Section surface="muted" aria-labelledby="supply-heading">
        <div className="grid gap-12 lg:grid-cols-[7fr_5fr] lg:gap-16">
          <div>
            <h2 id="supply-heading" className="text-h2 text-ink-950 font-bold">
              What we supply
            </h2>
            <p className="text-ink-700 mt-4">
              Research peptides as lyophilized powder in sealed vials. Every listing states the vial
              size, the list price, and the cost per milligram, so value is comparable across sizes
              rather than obscured by them.
            </p>
            <p className="text-ink-700 mt-4">
              We do not include diluents, syringes, or administration materials, and we do not
              supply anything intended for use in or on humans or animals.
            </p>

            <h2 className="text-h2 text-ink-950 mt-12 font-bold">Who we supply</h2>
            <p className="text-ink-700 mt-4">
              Research institutions, universities, contract research organisations, and qualified
              independent researchers. Purchasers must be at least 21 and either a qualified
              researcher or acting on behalf of a licensed institution or business.
            </p>

            <h2 className="text-h2 text-ink-950 mt-12 font-bold">How we work</h2>
            <p className="text-ink-700 mt-4">
              There is no checkout on this website, and that is deliberate. An inquiry is reviewed
              by a person who confirms availability, lot documentation and final pricing before
              anything is charged. It is slower than a card form and it is the right way to supply
              materials that carry eligibility conditions.
            </p>
          </div>

          {/*
            `self-start`, not a height. A grid item defaults to `align-items: stretch`,
            so this box was growing to match the left column's full height and ending
            in a long empty tail below the link. Aligning to the start makes it exactly
            as tall as its own content — same fix as the lab-testing page's asides.
          */}
          <aside className="border-brand-200 bg-brand-50 self-start rounded-xl border p-6">
            <ShieldCheckIcon className="text-brand-800 size-6" aria-hidden="true" />
            <h2 className="text-h3 text-ink-950 mt-3 font-semibold">What we are not</h2>
            <p className="text-ink-700 mt-3 text-sm">
              {SITE_NAME} is not a pharmacy, a compounding facility, or a healthcare provider. We do
              not provide dosing information, administration guidance, or medical advice, and our
              products are not for human or animal consumption.
            </p>
            <p className="text-ink-700 mt-3 text-sm">
              Nothing on this website is a recommendation to purchase or use any product for any
              purpose.
            </p>
            <Link
              href={ROUTES.researchUseOnly}
              className="text-brand-600 mt-4 inline-flex text-sm font-medium underline underline-offset-2"
            >
              Read our Research-Use-Only Policy
            </Link>
          </aside>
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-h2 text-ink-950 font-bold">Have a question first?</h2>
          <p className="text-ink-600 mt-4">
            Ask before you order. A representative would rather answer a question up front than
            resolve a problem afterwards.
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

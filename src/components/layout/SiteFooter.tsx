import Link from "next/link";
import { MailIcon } from "lucide-react";

import { Container } from "@/components/layout/Container";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { ROUTES } from "@/constants/routes";
import { COMPLIANCE_NOTICE_LONG, SITE_NAME } from "@/constants/site";
import { contactEmail } from "@/lib/env.client";

/**
 * Site footer.
 *
 * No newsletter signup: it adds a consent and compliance surface for no
 * lead-generation benefit, because the inquiry form is the conversion path.
 *
 * The copyright year is a build-time constant rather than `new Date()` in the
 * render. Calling `new Date()` in a prerendered path is a hard build error once
 * Cache Components is enabled (ADR-008), so avoiding it now keeps that migration
 * mechanical.
 */
const COPYRIGHT_YEAR = 2026;

const FOOTER_SECTIONS = [
  {
    heading: "Products",
    links: [
      { href: ROUTES.products, label: "All products" },
      { href: ROUTES.labTesting, label: "Lab testing & COAs" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: ROUTES.about, label: "About" },
      { href: ROUTES.contact, label: "Contact" },
      { href: ROUTES.shipping, label: "Shipping & payment" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: ROUTES.researchUseOnly, label: "Research-use-only policy" },
      { href: ROUTES.terms, label: "Terms of use" },
      { href: ROUTES.privacy, label: "Privacy policy" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="on-dark bg-ink-950 text-ink-300 mt-auto">
      <Container>
        <div className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            {/*
              The badge SVG has had its white background removed, so it renders
              cleanly on this near-black surface rather than as a white box.
            */}
            <BrandLogo size={44} tone="dark" withTagline />

            <p className="text-ink-400 mt-5 max-w-xs text-sm">
              Lyophilized research peptides supplied with lot documentation, for laboratory research
              use only.
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <nav key={section.heading} aria-labelledby={`footer-${section.heading}`}>
              <h2 id={`footer-${section.heading}`} className="text-eyebrow text-ink-400 uppercase">
                {section.heading}
              </h2>
              <ul className="mt-4 flex flex-col gap-3">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-ink-300 text-sm underline-offset-4 hover:text-white hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {contactEmail ? (
          <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 py-6">
            <a
              href={`mailto:${contactEmail}`}
              className="text-ink-300 inline-flex items-center gap-2 text-sm hover:text-white"
            >
              <MailIcon className="size-4" aria-hidden="true" />
              {contactEmail}
            </a>
          </div>
        ) : null}

        <div className="border-t border-white/10 py-6">
          <p className="text-tagline text-brand-300 uppercase">{COMPLIANCE_NOTICE_LONG}</p>
          <p className="text-ink-500 mt-3 text-xs">
            © {COPYRIGHT_YEAR} {SITE_NAME}.com. All rights reserved. {SITE_NAME} is not a pharmacy
            and does not provide medical advice.
          </p>
        </div>
      </Container>
    </footer>
  );
}

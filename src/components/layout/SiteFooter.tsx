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

/**
 * Site footer.
 *
 * Light rather than the near-black it used to be, and the reason is the mark. The
 * client's glyph is a black lattice with blue spheres on transparency — on `ink-950`
 * the lattice was the same colour as the surface behind it, so the logo lost its
 * structure and read as three disconnected dots.
 *
 * `ink-100` rather than the `ink-50` of the muted page bands: a page ending in a muted
 * section would otherwise run straight into the footer as one undifferentiated block.
 * One step darker plus the top border reads as a distinct region while staying inside
 * the same neutral ramp the rest of the site uses.
 */
export function SiteFooter() {
  return (
    <footer className="bg-ink-300 text-ink-900 border-ink-800 mt-auto border-t">
      <Container>
        <div className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            {/*
              The same lockup the header uses, and now the same tone too. The surface is
              light, so the wordmark's default `ink-950` is correct here — `tone="dark"`
              would render it white and invisible.
            */}
            <BrandLogo variant="mark" size={50} />

            <p className="mt-5 max-w-xs text-sm text-black">
              Lyophilized research peptides supplied with lot documentation, for laboratory research
              use only.
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <nav key={section.heading} aria-labelledby={`footer-${section.heading}`}>
              <h2 id={`footer-${section.heading}`} className="text-eyebrow text-black uppercase">
                {section.heading}
              </h2>
              <ul className="mt-4 flex flex-col gap-3">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="hover:text-brand-800 text-sm text-black underline-offset-4 hover:underline"
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
          <div className="border-ink-200 flex flex-wrap gap-x-8 gap-y-3 border-t py-6">
            <a
              href={`mailto:${contactEmail}`}
              className="text-ink-700 hover:text-brand-800 inline-flex items-center gap-2 text-sm"
            >
              <MailIcon className="size-4" aria-hidden="true" />
              {contactEmail}
            </a>
          </div>
        ) : null}

        <div className="border-ink-200 border-t py-6">
          {/*
            `brand-800` rather than the `brand-300` this line carried on the dark
            surface. The pale tint measured 1.6:1 here — it was chosen to be readable
            against near-black, and inverting the surface without re-picking it would
            have left the compliance notice the least legible text on the page.
          */}
          <p className="text-tagline text-black uppercase">{COMPLIANCE_NOTICE_LONG}</p>
          <p className="mt-3 text-xs text-black">
            © {COPYRIGHT_YEAR} {SITE_NAME}.com. All rights reserved. {SITE_NAME} is not a pharmacy
            and does not provide medical advice.
          </p>
        </div>
      </Container>
    </footer>
  );
}

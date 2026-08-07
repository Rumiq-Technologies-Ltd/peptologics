import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";

import { ComplianceStrip } from "@/components/layout/ComplianceStrip";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { JsonLd } from "@/components/shared/JsonLd";
import { SkipLink } from "@/components/shared/SkipLink";
import { Toaster } from "@/components/ui/sonner";
import { COMPLIANCE_NOTICE, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/constants/site";
import { CartHydrator } from "@/features/cart/components/CartHydrator";
import { DisclaimerGate } from "@/features/disclaimer/components/DisclaimerGate";
import { DisclaimerPrePaintScript } from "@/features/disclaimer/prePaintScript";
import { siteUrl } from "@/lib/env.client";
import { buildOrganizationSchema, buildWebSiteSchema } from "@/lib/seo/structuredData";

import "./globals.css";

/**
 * Inter for all UI and prose (mandated by CLAUDE.md). IBM Plex Mono for numeric
 * data only — product codes, vial sizes, prices — where a monospace face keeps
 * table columns optically aligned.
 *
 * Both are preloaded: mono appears inside fixed-width catalog columns, so a late
 * swap would shift row heights and cost CLS.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  // Required for relative canonical and Open Graph URLs. Without it, a page
  // exporting `alternates: { canonical: "/products" }` is a build error.
  metadataBase: new URL(siteUrl),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  /*
   * Open Graph and Twitter defaults, inherited by every page that does not override
   * them. The image is deliberately absent here: Next injects `opengraph-image.tsx`
   * automatically, and naming it as well would emit the tag twice.
   */
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: siteUrl,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  // The compliance position belongs in the document metadata as well as on the
  // page, so it travels with any excerpt of the site.
  other: { "compliance-notice": COMPLIANCE_NOTICE },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // Next 16 no longer overrides `scroll-behavior: smooth` during navigation;
      // this attribute restores the previous, less jarring behaviour.
      data-scroll-behavior="smooth"
      /*
       * REQUIRED, not cosmetic.
       *
       * The pre-paint script below sets `data-ruo="ok"` on this element before
       * React hydrates. Without this flag React treats that as a hydration
       * mismatch and, per Next's own guidance, "recovers by client-rendering from
       * the nearest error or Suspense boundary" — which in practice left every
       * streamed route stuck on its loading skeleton, because the suspense content
       * swap was discarded.
       *
       * With it, React keeps what the script put in the DOM and discards its own
       * output for this element only. Diagnosed from a real console hydration
       * error; see docs/decisions.md ADR-017.
       */
      suppressHydrationWarning
      className={`${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/*
          First child of <body>, deliberately NOT inside a hand-written <head>.
          Next manages <head> itself, and rendering one in a layout breaks
          streaming: the suspense swap script never ran, leaving every route with a
          loading skeleton permanently on screen. Verified by removing it.

          Here the script still executes before the gate element below is parsed,
          which is all it needs — it only sets an attribute on <html>, which already
          exists. That is early enough to suppress the flash and late enough not to
          interfere with anything.
        */}
        <DisclaimerPrePaintScript />

        {/*
          Organization and WebSite, emitted once for the whole site. Both use stable
          `@id`s, so page-level graphs reference them rather than redefining the
          publisher on every route.
        */}
        <JsonLd schema={[buildOrganizationSchema(), buildWebSiteSchema()]} />

        {/*
          #site-root is what the disclaimer gate marks `inert`. One attribute
          removes the whole page from the tab order, the accessibility tree and
          pointer events, so the gate needs no focus-sentinel elements — and the
          layout stays a Server Component.
        */}
        <div id="site-root" className="flex min-h-full flex-col">
          <SkipLink />
          <ComplianceStrip />
          <SiteHeader />

          {/* The skip link's target. tabIndex -1 makes it programmatically focusable. */}
          <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>

          <SiteFooter />
        </div>

        {/*
          Rendered outside #site-root so it is not caught by its own `inert`, and
          outside <main> so the gate's h2 never competes with the page's h1.
        */}
        <DisclaimerGate />

        {/*
          Without JavaScript the gate cannot mount, so the compliance statement is
          delivered statically instead. Flagged for the client as a residual
          exposure to accept (docs/decisions.md, ADR-009).
        */}
        <noscript>
          <div className="bg-ink-950 fixed inset-x-0 bottom-0 z-50 p-4 text-center text-sm text-white">
            JavaScript is required to acknowledge our Research Use Only policy. All products are
            supplied for laboratory research use only and are not for human or animal consumption.
          </div>
        </noscript>

        {/*
          Renders nothing. It reads the persisted inquiry list once, in an effect,
          after hydration — see CartHydrator for why that cannot happen earlier.
        */}
        <CartHydrator />

        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}

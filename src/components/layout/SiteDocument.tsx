import type { ReactNode } from "react";

import { displaySans, plexMono } from "@/components/layout/fonts";
import { ComplianceStrip } from "@/components/layout/ComplianceStrip";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { JsonLd } from "@/components/shared/JsonLd";
import { SkipLink } from "@/components/shared/SkipLink";
import { WebVitalsReporter } from "@/components/shared/WebVitalsReporter";
import { Toaster } from "@/components/ui/sonner";
import { CartHydrator } from "@/features/cart/components/CartHydrator";
import { DisclaimerGate } from "@/features/disclaimer/components/DisclaimerGate";
import { MotionPrePaintScript } from "@/components/motion/motionPrePaintScript";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { DisclaimerPrePaintScript } from "@/features/disclaimer/prePaintScript";
import { buildOrganizationSchema, buildWebSiteSchema } from "@/lib/seo/structuredData";

/**
 * The public site's whole HTML document: fonts, gate, chrome and providers.
 *
 * It lives here, not in the layout, because two files need it: the `(site)` layout and
 * `global-not-found.tsx`. With more than one root layout (the admin has its own, ADR-038),
 * Next renders an unmatched URL through `global-not-found`, and the visitor must still see
 * the site's own 404 inside the site's own chrome.
 */
export function SiteDocument({ children }: { children: ReactNode }) {
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
      className={`${displaySans.variable} ${plexMono.variable} h-full antialiased`}
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
          Arms the scroll-reveal CSS. Must run pre-paint for the same reason the gate
          script does — setting it after hydration would paint one frame of visible
          content before hiding it. See the component for why it fails open.
        */}
        <MotionPrePaintScript />

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

        {/*
          Renders nothing either. One IntersectionObserver for every `[data-reveal]`
          section on the page, rebuilt per route. Mounted here rather than per page so
          a section opts in with an attribute and stays a Server Component.
        */}
        <ScrollReveal />

        {/* Top, not bottom: a message on a phone would otherwise cover the sticky order bar. */}
        <Toaster position="top-center" />
        <WebVitalsReporter />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";

import { COMPLIANCE_NOTICE, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/constants/site";
import { siteUrl } from "@/lib/env.client";

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
      className={`${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/*
          #site-root is the element the disclaimer gate marks `inert` in Phase 3.
          Introducing it now means the gate can be added without restructuring the
          layout or turning it into a Client Component.
        */}
        <div id="site-root" className="flex min-h-full flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}

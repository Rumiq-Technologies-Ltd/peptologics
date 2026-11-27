import type { Metadata } from "next";

import { COMPLIANCE_NOTICE, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/constants/site";
import { siteUrl } from "@/lib/env.client";

/**
 * Site-wide metadata for the public site, shared by its layout and by `global-not-found`,
 * so an unmatched URL carries the same head as every other page.
 */
export const siteMetadata: Metadata = {
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

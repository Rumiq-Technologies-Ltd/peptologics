import type { MetadataRoute } from "next";

import { ROUTES } from "@/constants/routes";
import { siteUrl } from "@/lib/env.client";

/**
 * robots.txt.
 *
 * The disallow list is belt and braces: every path below already sends
 * `robots: { index: false }` in its metadata. Both matter, and they do different jobs
 * — `Disallow` stops the crawl, `noindex` stops the indexing. A page that is only
 * disallowed can still be indexed from an external link, showing a bare URL in
 * results; a page that is only `noindex` is crawled every time for nothing.
 *
 * `/api/` is disallowed because none of it is content. The one endpoint with a secret,
 * `POST /api/revalidate`, is protected by its bearer token rather than by this file —
 * robots.txt is a request, not a control.
 *
 * Production only advertises the sitemap when `NEXT_PUBLIC_SITE_URL` is a real origin.
 * A preview deployment inheriting the production URL here would invite crawlers to
 * index a staging build, which CLAUDE.md explicitly forbids.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        `${ROUTES.cart}`,
        `${ROUTES.inquiry}`,
        `${ROUTES.inquirySuccess}`,
        `${ROUTES.notEligible}`,
        "/api/",
      ],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
    host: siteUrl,
  };
}

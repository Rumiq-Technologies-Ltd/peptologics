import type { MetadataRoute } from "next";

import { env } from "@/lib/env";
import { siteUrl } from "@/lib/env.client";

/**
 * robots.txt.
 *
 * Only the production deployment is open to crawlers. A preview deployment or a local
 * build disallows everything, so a staging build cannot be indexed by inheriting the
 * production URL (CLAUDE.md forbids indexed staging environments). `VERCEL_ENV` is set by
 * Vercel alone, which is why it, rather than `NODE_ENV`, decides this.
 *
 * The utility pages (cart, inquiry, success, not-eligible) are deliberately not disallowed.
 * They send `noindex`, and a crawler can only see that directive if it is allowed to fetch
 * the page. Disallowing them would leave a bare URL open to being listed from an external
 * link with no content behind it.
 *
 * `/api/` is disallowed because none of it is content. The one endpoint with a secret,
 * `POST /api/revalidate`, is protected by its bearer token rather than by this file:
 * robots.txt is a request, not a control.
 */
export default function robots(): MetadataRoute.Robots {
  if (env.VERCEL_ENV !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
    host: siteUrl,
  };
}

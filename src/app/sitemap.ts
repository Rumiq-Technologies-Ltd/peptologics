import type { MetadataRoute } from "next";

import { ROUTES, SITEMAP_STATIC_ROUTES } from "@/constants/routes";
import { siteUrl } from "@/lib/env.client";
import { getContainer } from "@/services/container";

/**
 * XML sitemap.
 *
 * Lists only pages worth indexing. The cart, the inquiry form, its success page and
 * `/not-eligible` are all `noindex` and are deliberately absent — a sitemap that
 * advertises pages the robots meta tag then refuses is a crawl-budget contradiction
 * Search Console reports as an error.
 *
 * Product `lastModified` comes from `products.updated_at`, so a price change is
 * genuinely reflected. Faking it with `new Date()` on every request would train
 * crawlers to ignore the field.
 */

/**
 * One minute, as a literal (see products/page.tsx). On Amplify CloudFront keeps this page for this
 * long and nothing purges it after an admin save, so this is also the longest an edit can take to
 * show here (ADR-039).
 */
export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Never throws: the service catches its own failures and returns an empty list, so
  // a Supabase incident degrades the sitemap to the static routes instead of taking
  // the deploy down with it.
  const products = await getContainer().products.listSlugsForSitemap();

  const staticEntries: MetadataRoute.Sitemap = SITEMAP_STATIC_ROUTES.map((path) => ({
    url: new URL(path, siteUrl).toString(),
    changeFrequency: path === ROUTES.home || path === ROUTES.products ? "weekly" : "monthly",
    priority: path === ROUTES.home ? 1 : path === ROUTES.products ? 0.9 : 0.5,
  }));

  const productEntries: MetadataRoute.Sitemap = products.map(({ slug, updatedAt }) => ({
    url: new URL(ROUTES.product(slug), siteUrl).toString(),
    lastModified: new Date(updatedAt),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticEntries, ...productEntries];
}

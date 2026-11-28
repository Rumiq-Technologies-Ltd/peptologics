import "server-only";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/routes";

/**
 * Refreshes, in this process, the pages built from the catalog: the shop, the home page, Lab
 * Testing and the sitemap. The product page is dynamic and needs nothing (ADR-039). The list
 * matches what `POST /api/revalidate` purges, plus the sitemap. On Amplify this clears the
 * origin's cache only; CloudFront keeps a page for its `s-maxage` (60 seconds for these pages).
 */
export function revalidateCatalog(): void {
  for (const path of [ROUTES.home, ROUTES.products, ROUTES.labTesting, "/sitemap.xml"]) {
    revalidatePath(path);
  }
}

import "server-only";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/routes";

/**
 * Refreshes every page built from the catalog, right after a save, in this same process:
 * the product page (and the old address after a rename), the shop, the home page, Lab Testing
 * and the sitemap. The list matches what `POST /api/revalidate` purges, plus the sitemap.
 */
export function revalidateCatalog(productSlugs: readonly string[]): void {
  for (const slug of new Set(productSlugs)) revalidatePath(ROUTES.product(slug));

  for (const path of [ROUTES.home, ROUTES.products, ROUTES.labTesting, "/sitemap.xml"]) {
    revalidatePath(path);
  }
}

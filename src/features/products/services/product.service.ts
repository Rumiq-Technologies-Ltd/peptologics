import "server-only";

import type { ProductRepository } from "@/features/products/services/product.repository";
import type { Product, ProductListOptions, ProductSort } from "@/features/products/types/product";
import { FEATURED_PRODUCT_LIMIT } from "@/constants/business";
import { MESSAGES } from "@/constants/messages";
import { logger } from "@/lib/logger";
import { sanitizeText } from "@/lib/security/sanitize";
import { isValidSlug } from "@/utils/slugify";
import { fail, ok, type ServiceResult } from "@/types/result";

/**
 * Business rules for the catalog.
 *
 * Decides *what* to show and how requests are interpreted; the repository decides
 * only how to fetch. Knows nothing about React, HTTP, or rendering.
 */

/** Longest search term accepted. Beyond this it is noise, not a query. */
const MAX_SEARCH_LENGTH = 60;

const VALID_SORTS: readonly ProductSort[] = [
  "recommended",
  "name-asc",
  "price-asc",
  "price-desc",
  "value-asc",
];

export interface ProductService {
  listActive(options?: ProductListOptions): Promise<ServiceResult<Product[]>>;
  listFeatured(): Promise<ServiceResult<Product[]>>;
  getBySlug(slug: string): Promise<ServiceResult<Product>>;
  listSlugsForSitemap(): Promise<{ slug: string; updatedAt: string }[]>;
  /** Narrows an untrusted `?sort=` value to a supported option. */
  resolveSort(value: string | undefined): ProductSort;
}

export interface ProductServiceDeps {
  repository: ProductRepository;
}

export function createProductService({ repository }: ProductServiceDeps): ProductService {
  return {
    resolveSort(value): ProductSort {
      return (VALID_SORTS as readonly string[]).includes(value ?? "")
        ? (value as ProductSort)
        : "recommended";
    },

    async listActive(options = {}): Promise<ServiceResult<Product[]>> {
      // Search text comes from a URL, so it is untrusted: normalise invisible
      // characters, cap the length, and treat a blank result as no filter at all.
      const search = options.search ? sanitizeText(options.search).slice(0, MAX_SEARCH_LENGTH) : "";

      try {
        const products = await repository.findActive({
          ...options,
          search: search || undefined,
        });

        return ok(products);
      } catch (error) {
        logger.error("products_list_failed", { error, search: Boolean(search) });
        return fail("UNEXPECTED", MESSAGES.products.loadFailed);
      }
    },

    async listFeatured(): Promise<ServiceResult<Product[]>> {
      try {
        const featured = await repository.findFeatured(FEATURED_PRODUCT_LIMIT);

        // A catalog with nothing flagged `featured` should not leave the home page
        // with an empty section, so fall back to the top of the default order.
        if (featured.length === 0) {
          const fallback = await repository.findActive({
            sort: "recommended",
            limit: FEATURED_PRODUCT_LIMIT,
          });
          return ok(fallback);
        }

        return ok(featured);
      } catch (error) {
        logger.error("products_featured_failed", { error });
        return fail("UNEXPECTED", MESSAGES.products.loadFailed);
      }
    },

    async getBySlug(slug): Promise<ServiceResult<Product>> {
      // Reject a malformed slug before spending a query on it. Slugs are authored,
      // so anything not matching the pattern cannot exist.
      if (!isValidSlug(slug)) {
        return fail("NOT_FOUND", MESSAGES.products.notFound);
      }

      try {
        const product = await repository.findBySlug(slug);

        if (!product) {
          return fail("NOT_FOUND", MESSAGES.products.notFound);
        }

        return ok(product);
      } catch (error) {
        logger.error("product_fetch_failed", { error, slug });
        return fail("UNEXPECTED", MESSAGES.products.loadFailed);
      }
    },

    async listSlugsForSitemap(): Promise<{ slug: string; updatedAt: string }[]> {
      try {
        return await repository.listActiveSlugs();
      } catch (error) {
        // A sitemap must never take a deploy down. Log and emit static routes only.
        logger.error("product_slugs_failed", { error });
        return [];
      }
    },
  };
}

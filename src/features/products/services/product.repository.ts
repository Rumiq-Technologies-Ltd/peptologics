import "server-only";

import {
  toProduct,
  toProducts,
  type ProductRow,
} from "@/features/products/mappers/product.mappers";
import type { Product, ProductListOptions, ProductSort } from "@/features/products/types/product";
import { DatabaseError } from "@/lib/errors";
import { getReadClient } from "@/lib/supabase/client.server";

/**
 * Database access for products. Fetch only — no business decisions.
 *
 * Reads use the publishable key, so RLS narrows every result to
 * `status = 'active' AND deleted_at IS NULL` regardless of what is asked for.
 * The filters below are therefore belt-and-braces rather than the only gate.
 */

/**
 * Explicit column list. `SELECT *` is forbidden (CLAUDE.md) and would also drag
 * audit timestamps over the wire on every catalog render for nothing.
 */
const PRODUCT_COLUMNS =
  "id, slug, name, description, category, strength_mg, strength_unit, price_cents, cost_per_mg, is_blend, featured, sort_order, image_url, coa_url, status";

export interface ProductRepository {
  findActive(options?: ProductListOptions): Promise<Product[]>;
  findFeatured(limit: number): Promise<Product[]>;
  findBySlug(slug: string): Promise<Product | null>;
  findByIds(ids: readonly string[]): Promise<Product[]>;
  listActiveSlugs(): Promise<{ slug: string; updatedAt: string }[]>;
}

/** Escapes PostgREST `ilike` wildcards so a search for "%" is literal. */
function escapeLikePattern(term: string): string {
  return term.replace(/[%_\\]/g, (character) => `\\${character}`);
}

export function createProductRepository(): ProductRepository {
  const client = getReadClient();

  /** Applies the requested sort. Sorting happens in SQL, never in the browser. */
  function applySort<T extends { order: (column: string, options: { ascending: boolean }) => T }>(
    query: T,
    sort: ProductSort,
  ): T {
    switch (sort) {
      case "name-asc":
        return query.order("name", { ascending: true });
      case "price-asc":
        return query.order("price_cents", { ascending: true });
      case "price-desc":
        return query.order("price_cents", { ascending: false });
      case "value-asc":
        // Best value per milligram. Only meaningful because cost_per_mg is a
        // stored generated column and therefore indexable (ADR-003).
        return query.order("cost_per_mg", { ascending: true });
      case "recommended":
      default:
        return query.order("sort_order", { ascending: true }).order("name", { ascending: true });
    }
  }

  return {
    async findActive(options = {}): Promise<Product[]> {
      let query = client
        .from("products")
        .select(PRODUCT_COLUMNS)
        .eq("status", "active")
        .is("deleted_at", null);

      if (options.category) {
        query = query.eq("category", options.category);
      }

      if (options.search) {
        query = query.ilike("name", `%${escapeLikePattern(options.search)}%`);
      }

      query = applySort(query, options.sort ?? "recommended");

      if (options.limit !== undefined) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        throw new DatabaseError("products.findActive", error.message, { cause: error });
      }

      return toProducts((data ?? []) as unknown as ProductRow[]);
    },

    async findFeatured(limit): Promise<Product[]> {
      const { data, error } = await client
        .from("products")
        .select(PRODUCT_COLUMNS)
        .eq("status", "active")
        .eq("featured", true)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .limit(limit);

      if (error) {
        throw new DatabaseError("products.findFeatured", error.message, { cause: error });
      }

      return toProducts((data ?? []) as unknown as ProductRow[]);
    },

    async findBySlug(slug): Promise<Product | null> {
      const { data, error } = await client
        .from("products")
        .select(PRODUCT_COLUMNS)
        .eq("slug", slug)
        .eq("status", "active")
        .is("deleted_at", null)
        // maybeSingle, not single: an unknown slug is an ordinary 404, not an
        // exception. `single` would raise PGRST116 and force a try/catch here.
        .maybeSingle();

      if (error) {
        throw new DatabaseError("products.findBySlug", error.message, { cause: error });
      }

      return data ? toProduct(data as unknown as ProductRow) : null;
    },

    async findByIds(ids): Promise<Product[]> {
      if (ids.length === 0) return [];

      const { data, error } = await client
        .from("products")
        .select(PRODUCT_COLUMNS)
        .in("id", [...ids])
        .eq("status", "active")
        .is("deleted_at", null);

      if (error) {
        throw new DatabaseError("products.findByIds", error.message, { cause: error });
      }

      return toProducts((data ?? []) as unknown as ProductRow[]);
    },

    async listActiveSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
      const { data, error } = await client
        .from("products")
        .select("slug, updated_at")
        .eq("status", "active")
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });

      if (error) {
        throw new DatabaseError("products.listActiveSlugs", error.message, { cause: error });
      }

      return (data ?? []).map((row) => ({ slug: row.slug, updatedAt: row.updated_at }));
    },
  };
}

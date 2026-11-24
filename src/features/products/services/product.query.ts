import type { ProductRow } from "@/features/products/mappers/product.mappers";
import type { ProductListOptions, ProductSort } from "@/features/products/types/product";

/**
 * Catalog filtering and sorting, done on the server over the whole catalog (D5, ADR-036).
 *
 * DynamoDB cannot filter by substring or sort by an arbitrary column, so the repository
 * reads the catalog in one Query and these pure functions do what the SQL used to. They
 * are separate from the repository so they can be tested without a database.
 */

/** A stored product: the mapper's row plus the soft-delete marker. */
export interface ProductRecord extends ProductRow {
  deleted_at?: string | null;
  updated_at?: string | null;
}

/** Only active, non-deleted products are public. The old RLS rule, now in code. */
export function isPublicProduct(record: ProductRecord): boolean {
  return record.status === "active" && !record.deleted_at;
}

function byRecommended(a: ProductRecord, b: ProductRecord): number {
  return a.sort_order - b.sort_order || a.name.localeCompare(b.name, "en");
}

function compareBy(sort: ProductSort): (a: ProductRecord, b: ProductRecord) => number {
  switch (sort) {
    case "name-asc":
      return (a, b) => a.name.localeCompare(b.name, "en") || a.sort_order - b.sort_order;
    case "price-asc":
      return (a, b) => a.price_cents - b.price_cents || byRecommended(a, b);
    case "price-desc":
      return (a, b) => b.price_cents - a.price_cents || byRecommended(a, b);
    case "value-asc":
      // Best value per milligram first.
      return (a, b) => Number(a.cost_per_mg) - Number(b.cost_per_mg) || byRecommended(a, b);
    case "recommended":
    default:
      return byRecommended;
  }
}

/** Public products matching the options, sorted, then limited. Never mutates its input. */
export function selectPublicProducts(
  records: readonly ProductRecord[],
  options: ProductListOptions = {},
): ProductRecord[] {
  const search = options.search?.trim().toLowerCase();

  const selected = records
    .filter(isPublicProduct)
    .filter((record) => !options.category || record.category === options.category)
    .filter((record) => !search || record.name.toLowerCase().includes(search))
    .sort(compareBy(options.sort ?? "recommended"));

  return options.limit === undefined ? selected : selected.slice(0, options.limit);
}

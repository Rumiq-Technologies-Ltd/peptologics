import type {
  Product,
  ProductCategory,
  ProductStatus,
  StrengthUnit,
} from "@/features/products/types/product";

/**
 * The single row-to-domain boundary for products.
 *
 * Everything awkward about the storage layer is resolved here and nowhere else,
 * which is the whole reason this file exists as a separate module.
 */

/**
 * The columns the repository actually selects, in the shape PostgREST returns
 * them. Written by hand rather than derived from the generated `Row` type because
 * the generated type is wrong at runtime in two ways:
 *
 *   - `strength_mg` and `cost_per_mg` are Postgres `numeric`. PostgREST
 *     serialises numeric as a JSON **string** to avoid IEEE-754 loss, so these
 *     arrive as "10.000" and "6.0000" despite being typed `number`.
 *   - `cost_per_mg` is generated, so it is never actually null on a stored row,
 *     but the schema permits null.
 *
 * Typing the input honestly is what makes the coercion below visible instead of
 * an invisible `string` masquerading as a `number` throughout the application.
 */
export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  strength_mg: number | string;
  strength_unit: string;
  price_cents: number;
  cost_per_mg: number | string | null;
  is_blend: boolean;
  featured: boolean;
  sort_order: number;
  image_url: string | null;
  coa_url: string | null;
  status: string;
}

const PRODUCT_STATUSES: readonly ProductStatus[] = ["active", "out_of_stock", "archived"];
const PRODUCT_CATEGORIES: readonly ProductCategory[] = ["peptide", "blend", "cosmetic", "supply"];
const STRENGTH_UNITS: readonly StrengthUnit[] = ["mg", "ml"];

/**
 * Coerces a PostgREST numeric to a JavaScript number.
 *
 * Safe for `strength_mg` (a vial size) and `cost_per_mg` (a display figure).
 * Deliberately **not** used for anything in cents — money stays integer.
 */
function toNumber(value: number | string | null, fallback: number): number {
  if (typeof value === "number") return value;
  if (value === null) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Narrows a CHECK-constrained text column to its union type.
 *
 * The database guarantees the value is one of the allowed set, but the generated
 * type says `string`. Falling back rather than throwing means a value added to
 * the CHECK constraint before this list is updated degrades the display instead
 * of taking a page down.
 */
function toEnum<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function toProduct(row: ProductRow): Product {
  const strengthMg = toNumber(row.strength_mg, 0);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: toEnum(row.category, PRODUCT_CATEGORIES, "peptide"),
    strengthMg,
    strengthUnit: toEnum(row.strength_unit, STRENGTH_UNITS, "mg"),
    priceCents: row.price_cents,
    // The database computes this, but recompute the fallback from cents rather
    // than defaulting to 0 — a missing generated value should not render "$0/mg".
    costPerMg: toNumber(row.cost_per_mg, strengthMg > 0 ? row.price_cents / 100 / strengthMg : 0),
    isBlend: row.is_blend,
    featured: row.featured,
    sortOrder: row.sort_order,
    imageUrl: row.image_url,
    coaUrl: row.coa_url,
    status: toEnum(row.status, PRODUCT_STATUSES, "archived"),
  };
}

export function toProducts(rows: readonly ProductRow[]): Product[] {
  return rows.map(toProduct);
}

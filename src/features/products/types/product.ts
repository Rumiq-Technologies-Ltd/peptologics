/**
 * The domain shape of a product, as the rest of the application sees it.
 *
 * Deliberately not the database row type. Row types leak storage concerns —
 * `numeric` columns arriving as strings, a generated column that is nullable in
 * the schema but never null in practice, audit timestamps nothing renders. The
 * mapper is the boundary that resolves all of that once.
 */

export type ProductStatus = "active" | "out_of_stock" | "archived";

export type ProductCategory = "peptide" | "blend" | "cosmetic" | "supply";

export interface Product {
  id: string;
  slug: string;
  name: string;
  /** Client-supplied copy. Null for every product until they provide it. */
  description: string | null;
  category: ProductCategory;
  /** Milligrams per vial. */
  strengthMg: number;
  /** Integer cents. Never a float, never a string. */
  priceCents: number;
  /**
   * Dollars per milligram, derived by the database. Display only — it must never
   * enter money arithmetic, because it is a rounded quotient.
   */
  costPerMg: number;
  /**
   * A blend's cost-per-mg is not comparable to a single peptide's, so the UI
   * suppresses the figure when this is true.
   */
  isBlend: boolean;
  featured: boolean;
  sortOrder: number;
  imageUrl: string | null;
  coaUrl: string | null;
  status: ProductStatus;
}

/** Sort options exposed in the catalog UI. Resolved to SQL in the repository. */
export type ProductSort = "recommended" | "name-asc" | "price-asc" | "price-desc" | "value-asc";

export interface ProductListOptions {
  sort?: ProductSort;
  /** Free-text search across name. Matched in SQL, never in the browser. */
  search?: string;
  category?: ProductCategory;
  limit?: number;
}

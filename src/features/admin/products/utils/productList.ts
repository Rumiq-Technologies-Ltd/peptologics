import type { AdminProduct } from "@/features/admin/products/types";
import type { ProductCategory, ProductStatus } from "@/features/products/types/product";
import { FEATURED_PRODUCT_LIMIT } from "@/constants/business";

/** Pure list logic for the products table: filter, sort, and what the home page will show. */

export type ProductSortKey = "order" | "name" | "price-asc" | "price-desc";

export interface ProductListFilters {
  search: string;
  status: ProductStatus | "all";
  category: ProductCategory | "all";
  sort: ProductSortKey;
}

export const DEFAULT_FILTERS: ProductListFilters = {
  search: "",
  status: "all",
  category: "all",
  sort: "order",
};

export const STATUS_LABELS: Record<ProductStatus, string> = {
  active: "Active",
  out_of_stock: "Out of stock",
  archived: "Archived",
};

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  peptide: "Peptide",
  blend: "Blend",
  cosmetic: "Cosmetic",
  supply: "Supply",
};

function byOrder(a: AdminProduct, b: AdminProduct): number {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "en");
}

export function filterAndSortProducts(
  products: readonly AdminProduct[],
  filters: ProductListFilters,
): AdminProduct[] {
  const search = filters.search.trim().toLowerCase();

  const sorters: Record<ProductSortKey, (a: AdminProduct, b: AdminProduct) => number> = {
    order: byOrder,
    name: (a, b) => a.name.localeCompare(b.name, "en") || byOrder(a, b),
    "price-asc": (a, b) => a.priceCents - b.priceCents || byOrder(a, b),
    "price-desc": (a, b) => b.priceCents - a.priceCents || byOrder(a, b),
  };

  return products
    .filter((product) => filters.status === "all" || product.status === filters.status)
    .filter((product) => filters.category === "all" || product.category === filters.category)
    .filter(
      (product) =>
        !search ||
        product.name.toLowerCase().includes(search) ||
        product.slug.toLowerCase().includes(search),
    )
    .sort(sorters[filters.sort]);
}

/** The products the home page shows: the first featured active ones, in display order (D32). */
export function homePageProducts(products: readonly AdminProduct[]): AdminProduct[] {
  return products
    .filter((product) => product.featured && product.status === "active")
    .sort(byOrder)
    .slice(0, FEATURED_PRODUCT_LIMIT);
}

/** Reordering is only meaningful on the full list in display order. */
export function canReorder(filters: ProductListFilters): boolean {
  return (
    filters.sort === "order" &&
    filters.status === "all" &&
    filters.category === "all" &&
    filters.search.trim() === ""
  );
}

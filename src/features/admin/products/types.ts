import type {
  ProductCategory,
  ProductStatus,
  StrengthUnit,
} from "@/features/products/types/product";
import type { AdminRole } from "@/lib/admin/roles";

/** A product as the admin sees it: every status, plus the lock version and retired slugs. */
export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: ProductCategory;
  strength: number;
  strengthUnit: StrengthUnit;
  priceCents: number;
  /** Computed on save, never entered. Only meaningful for mg products. */
  costPerMg: number;
  isBlend: boolean;
  featured: boolean;
  sortOrder: number;
  imageUrl: string | null;
  status: ProductStatus;
  /** Optimistic-lock counter. 0 for an item that has never been saved from the admin. */
  version: number;
  /** Slugs this product used to have; each one redirects here (D26). */
  previousSlugs: string[];
  createdAt: string;
  updatedAt: string;
}

/** Who is making a change, for the audit log. */
export interface AdminActor {
  email: string;
  role: AdminRole;
  requestId: string;
}

/** What a successful save tells the action layer to refresh. */
export interface ProductChangeOutcome {
  product: AdminProduct;
  /** Names of the fields that changed. Empty when the save changed nothing. */
  changedFields: string[];
  /** Product-page slugs whose cached page is now out of date (the old slug after a rename). */
  staleSlugs: string[];
  /** True when a new page must be built: a new product, or a new slug. */
  needsBuild: boolean;
}

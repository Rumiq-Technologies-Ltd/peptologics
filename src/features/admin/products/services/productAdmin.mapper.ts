import type { AdminProduct } from "@/features/admin/products/types";
import type {
  ProductCategory,
  ProductStatus,
  StrengthUnit,
} from "@/features/products/types/product";
import type { Item } from "@/lib/dynamodb/entities";

/** A stored product item to the admin's shape. Absent attributes are DynamoDB's nulls. */
export function toAdminProduct(item: Item): AdminProduct {
  const createdAt =
    typeof item.created_at === "string" ? item.created_at : new Date(0).toISOString();

  return {
    id: String(item.id),
    slug: String(item.slug),
    name: String(item.name),
    description: typeof item.description === "string" ? item.description : null,
    category: item.category as ProductCategory,
    strength: Number(item.strength_mg),
    strengthUnit: item.strength_unit as StrengthUnit,
    priceCents: Number(item.price_cents),
    costPerMg: Number(item.cost_per_mg),
    isBlend: item.is_blend === true,
    featured: item.featured === true,
    sortOrder: Number(item.sort_order),
    imageUrl: typeof item.image_url === "string" ? item.image_url : null,
    status: item.status as ProductStatus,
    version: typeof item.version === "number" ? item.version : 0,
    previousSlugs: Array.isArray(item.previous_slugs) ? (item.previous_slugs as string[]) : [],
    createdAt,
    updatedAt: typeof item.updated_at === "string" ? item.updated_at : createdAt,
  };
}

/** Admin list order: the shop's order, so what staff see is what visitors see. */
export function bySortOrder(a: AdminProduct, b: AdminProduct): number {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "en");
}

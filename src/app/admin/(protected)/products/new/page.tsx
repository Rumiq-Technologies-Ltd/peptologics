import type { Metadata } from "next";

import { ProductForm } from "@/features/admin/products/components/ProductForm";
import { getProductAdmin } from "@/features/admin/products/services/container.server";
import { SORT_ORDER_STEP } from "@/features/admin/products/services/productAdmin.service";
import { requireAdmin } from "@/lib/admin/authorize.server";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  await requireAdmin({ role: "editor" });

  const { products, images } = getProductAdmin();
  const list = await products.list();
  const lastOrder = list.reduce((highest, product) => Math.max(highest, product.sortOrder), 0);

  return (
    <div className="mx-auto max-w-6xl">
      <ProductForm defaultSortOrder={lastOrder + SORT_ORDER_STEP} uploadEnabled={images !== null} />
    </div>
  );
}

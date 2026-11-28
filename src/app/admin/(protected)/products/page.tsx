import type { Metadata } from "next";

import { ProductsTable } from "@/features/admin/products/components/ProductsTable";
import { getProductAdmin } from "@/features/admin/products/services/container.server";
import { requireAdmin } from "@/lib/admin/authorize.server";

export const metadata: Metadata = { title: "Products" };

export default async function AdminProductsPage() {
  await requireAdmin({ role: "editor" });

  const list = await getProductAdmin().products.list();

  return (
    <div className="mx-auto max-w-6xl">
      <ProductsTable products={list} />
    </div>
  );
}

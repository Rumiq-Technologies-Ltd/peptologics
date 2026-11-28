import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductForm } from "@/features/admin/products/components/ProductForm";
import { getProductAdmin } from "@/features/admin/products/services/container.server";
import { requireAdmin } from "@/lib/admin/authorize.server";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage(props: PageProps<"/admin/products/[id]">) {
  await requireAdmin({ role: "editor" });

  const { id } = await props.params;
  const { products, images } = getProductAdmin();
  const product = await products.get(id);

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-6xl">
      <ProductForm
        product={product}
        defaultSortOrder={product.sortOrder}
        uploadEnabled={images !== null}
      />
    </div>
  );
}

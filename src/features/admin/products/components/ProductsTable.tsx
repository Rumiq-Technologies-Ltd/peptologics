"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, StarIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  publishPendingPagesAction,
  reorderProductAction,
  setProductFeaturedAction,
  setProductStatusAction,
} from "@/features/admin/products/actions/productActions";
import type { ProductActionResult } from "@/features/admin/products/actions/actionResult";
import type { AdminProduct } from "@/features/admin/products/types";
import {
  CATEGORY_LABELS,
  DEFAULT_FILTERS,
  STATUS_LABELS,
  canReorder,
  filterAndSortProducts,
  homePageProducts,
  type ProductListFilters,
  type ProductSortKey,
} from "@/features/admin/products/utils/productList";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatStrength } from "@/utils/formatStrength";
import { cn } from "@/utils/cn";

import { ArchiveProductDialog } from "./ArchiveProductDialog";
import { ProductThumb } from "./ProductThumb";

interface ProductsTableProps {
  products: AdminProduct[];
  /** True while pages from earlier saves are still waiting for a build. */
  pagesWaiting: boolean;
}

const SELECT_CLASS =
  "border-input bg-background h-9 rounded-md border px-3 text-sm focus-visible:ring-[3px] focus-visible:ring-ring outline-none";

const STATUS_BADGE: Record<AdminProduct["status"], string> = {
  active: "bg-emerald-100 text-emerald-900",
  out_of_stock: "bg-amber-100 text-amber-900",
  archived: "bg-ink-200 text-ink-800",
};

/**
 * The products list. Filtering and sorting run here, over the whole list the server sent
 * (about thirty products), so they are instant. Every change goes through a server action;
 * the page is then refreshed so the list always shows what is saved.
 */
export function ProductsTable({ products, pagesWaiting }: ProductsTableProps) {
  const router = useRouter();
  const [filters, setFilters] = useState<ProductListFilters>(DEFAULT_FILTERS);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [archiving, setArchiving] = useState<AdminProduct | null>(null);

  const visible = useMemo(() => filterAndSortProducts(products, filters), [products, filters]);
  const homeProducts = useMemo(() => homePageProducts(products), [products]);
  const reorderable = canReorder(filters);

  function update<K extends keyof ProductListFilters>(key: K, value: ProductListFilters[K]): void {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function run(task: () => Promise<ProductActionResult>): void {
    setStatus(null);
    startTransition(async () => {
      const result = await task();
      setStatus({ ok: result.success, text: result.message });
      setArchiving(null);
      if (result.success || result.code === "VERSION_CONFLICT") router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-ink-950 text-2xl font-bold">Products</h1>
        <Link href="/admin/products/new" className={buttonVariants()}>
          <PlusIcon aria-hidden="true" /> Add product
        </Link>
      </div>

      {pagesWaiting ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p>Some new product pages are waiting for a site build before they go live.</p>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(publishPendingPagesAction)}
          >
            Publish now
          </Button>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-medium">
          Search by name
          <Input
            type="search"
            className="bg-white dark:bg-white"
            value={filters.search}
            onChange={(event) => update("search", event.target.value)}
            placeholder="Name or web address"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Status
          <select
            className={SELECT_CLASS}
            value={filters.status}
            onChange={(event) =>
              update("status", event.target.value as ProductListFilters["status"])
            }
          >
            <option value="all">All</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Category
          <select
            className={SELECT_CLASS}
            value={filters.category}
            onChange={(event) =>
              update("category", event.target.value as ProductListFilters["category"])
            }
          >
            <option value="all">All</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Sort by
          <select
            className={SELECT_CLASS}
            value={filters.sort}
            onChange={(event) => update("sort", event.target.value as ProductSortKey)}
          >
            <option value="order">Display order</option>
            <option value="name">Name</option>
            <option value="price-asc">Price, low to high</option>
            <option value="price-desc">Price, high to low</option>
          </select>
        </label>
      </div>

      <p className="text-ink-700 mt-4 text-sm">
        The home page shows:{" "}
        <strong>
          {homeProducts.map((product) => product.name).join(", ") || "no products yet"}
        </strong>{" "}
        (the first three featured active products, in display order).
        {!reorderable ? " Clear the filters and sort by display order to reorder." : ""}
      </p>

      <p
        role="status"
        aria-live="polite"
        className={cn("mt-3 min-h-5 text-sm", status && !status.ok && "text-red-700")}
      >
        {status?.text}
      </p>

      {visible.length === 0 ? (
        <div className="border-ink-200 mt-4 rounded-lg border bg-white p-8 text-center">
          <p className="text-ink-950 font-medium">No products match.</p>
          <p className="text-ink-700 mt-1 text-sm">Try a different search or clear the filters.</p>
          <Button className="mt-4" variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div
          role="region"
          aria-label="Products table"
          tabIndex={0}
          className="border-ink-200 mt-2 overflow-x-auto rounded-lg border bg-white"
        >
          <table className="w-full min-w-[46rem] text-left text-sm">
            <caption className="sr-only">Products</caption>
            <thead className="border-ink-200 text-ink-600 border-b text-xs uppercase">
              <tr>
                <th scope="col" className="p-3">
                  Product
                </th>
                <th scope="col" className="p-3">
                  Strength
                </th>
                <th scope="col" className="p-3">
                  Price
                </th>
                <th scope="col" className="p-3">
                  Status
                </th>
                <th scope="col" className="p-3">
                  Featured
                </th>
                <th scope="col" className="p-3">
                  Order
                </th>
                <th scope="col" className="p-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-ink-200 divide-y">
              {visible.map((product, index) => (
                <tr key={product.id}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <ProductThumb src={product.imageUrl} name={product.name} />
                      <div className="min-w-0">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="text-ink-950 font-medium underline-offset-4 hover:underline"
                        >
                          {product.name}
                        </Link>
                        <p className="text-ink-600 truncate font-mono text-xs">{product.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 font-mono">
                    {formatStrength(product.strength, product.strengthUnit)}
                  </td>
                  <td className="p-3 font-mono">{formatCurrency(product.priceCents)}</td>
                  <td className="p-3">
                    <Badge className={STATUS_BADGE[product.status]}>
                      {STATUS_LABELS[product.status]}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-pressed={product.featured}
                      aria-label={`${product.featured ? "Remove" : "Mark"} ${product.name} ${product.featured ? "from" : "as"} featured`}
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          setProductFeaturedAction(product.id, product.version, !product.featured),
                        )
                      }
                    >
                      <StarIcon
                        aria-hidden="true"
                        className={cn(product.featured && "fill-amber-400 text-amber-500")}
                      />
                    </Button>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Move ${product.name} up`}
                        disabled={pending || !reorderable || index === 0}
                        onClick={() => run(() => reorderProductAction(product.id, "up"))}
                      >
                        <ArrowUpIcon aria-hidden="true" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Move ${product.name} down`}
                        disabled={pending || !reorderable || index === visible.length - 1}
                        onClick={() => run(() => reorderProductAction(product.id, "down"))}
                      >
                        <ArrowDownIcon aria-hidden="true" />
                      </Button>
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    {product.status === "archived" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(() => setProductStatusAction(product.id, product.version, "active"))
                        }
                      >
                        Restore
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => setArchiving(product)}
                      >
                        Archive
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ArchiveProductDialog
        productName={archiving?.name ?? null}
        pending={pending}
        onCancel={() => setArchiving(null)}
        onConfirm={() => {
          if (archiving)
            run(() => setProductStatusAction(archiving.id, archiving.version, "archived"));
        }}
      />
    </div>
  );
}

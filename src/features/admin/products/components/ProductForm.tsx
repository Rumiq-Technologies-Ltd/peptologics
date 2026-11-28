"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch, type DefaultValues } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProductActionResult } from "@/features/admin/products/actions/actionResult";
import {
  createProductAction,
  setProductStatusAction,
  updateProductAction,
} from "@/features/admin/products/actions/productActions";
import type { AdminProduct } from "@/features/admin/products/types";
import { suggestProductSlug } from "@/features/admin/products/utils/productSlug";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/features/admin/products/utils/productList";
import {
  MAX_PRODUCT_DESCRIPTION_LENGTH,
  productInputSchema,
  type ProductInput,
} from "@/features/admin/products/validation/product.schema";
import { computeCostPerMg } from "@/lib/dynamodb/entities";
import { formatCostPerMg } from "@/utils/formatCurrency";

import { ProductImageField } from "./ProductImageField";

interface ProductFormProps {
  /** Absent when adding a product. */
  product?: AdminProduct;
  /** The display order a new product starts with: after the last one. */
  defaultSortOrder: number;
  uploadEnabled: boolean;
}

/** Focused after a failed save so a keyboard or screen-reader user lands on the message. */
const SUMMARY_ID = "product-form-summary";

const SELECT_CLASS =
  "border-input bg-background h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-[3px] focus-visible:ring-ring outline-none";

/** Vial size and price start empty on a new product, so typing "10" gives 10, not "010". */
function toValues(
  product: AdminProduct | undefined,
  defaultSortOrder: number,
): DefaultValues<ProductInput> {
  if (!product) {
    return {
      name: "",
      slug: "",
      description: "",
      category: "peptide",
      strengthUnit: "mg",
      status: "active",
      featured: false,
      sortOrder: defaultSortOrder,
      imageUrl: undefined,
    };
  }

  return {
    name: product.name,
    slug: product.slug,
    description: product.description ?? "",
    category: product.category,
    strength: product.strength,
    strengthUnit: product.strengthUnit,
    price: product.priceCents / 100,
    status: product.status,
    featured: product.featured,
    sortOrder: product.sortOrder,
    imageUrl: product.imageUrl ?? undefined,
  };
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-ink-600 text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Adds or edits a product. Validates with the same schema the server action re-checks, keeps the
 * saved version it was opened with, and shows the "changed since you opened it" message when
 * someone else saved first.
 */
export function ProductForm({ product, defaultSortOrder, uploadEnabled }: ProductFormProps) {
  const router = useRouter();
  const [current, setCurrent] = useState<AdminProduct | undefined>(product);
  const [result, setResult] = useState<ProductActionResult | null>(null);
  const [slugEdited, setSlugEdited] = useState(Boolean(product));

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProductInput>({
    resolver: standardSchemaResolver(productInputSchema),
    mode: "onBlur",
    defaultValues: toValues(product, defaultSortOrder),
  });

  const [name, strength, unit, price, slug, category] = useWatch({
    control,
    name: ["name", "strength", "strengthUnit", "price", "slug", "category"],
  });

  const hasSizeAndPrice = strength > 0 && price >= 0;
  const showsCost = unit === "mg" && category !== "blend" && hasSizeAndPrice;
  const costLabel = showsCost
    ? formatCostPerMg(computeCostPerMg(Math.round(price * 100), strength))
    : hasSizeAndPrice
      ? "Not applicable"
      : "shown once you enter a size and price";

  function suggestSlug(): void {
    setValue(
      "slug",
      suggestProductSlug(getValues("name"), getValues("strength"), getValues("strengthUnit")),
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );
  }

  function maybeSuggestSlug(): void {
    // Until staff edit the web address themselves it follows the name and size.
    if (!slugEdited) suggestSlug();
  }

  function focusSummary(): void {
    document.getElementById(SUMMARY_ID)?.focus();
  }

  async function onSubmit(values: ProductInput): Promise<void> {
    setResult(null);
    const outcome = current
      ? await updateProductAction(current.id, current.version, values)
      : await createProductAction(values);

    setResult(outcome);

    if (outcome.success) {
      if (outcome.product) {
        setCurrent(outcome.product);
        reset(toValues(outcome.product, defaultSortOrder));
        setSlugEdited(true);
      }
      return;
    }

    for (const [field, messages] of Object.entries(outcome.fieldErrors ?? {})) {
      setError(field as keyof ProductInput, { type: "server", message: messages[0] });
    }
    focusSummary();
  }

  async function restore(): Promise<void> {
    if (!current) return;
    const outcome = await setProductStatusAction(current.id, current.version, "active");
    setResult(outcome);
    if (outcome.success && outcome.product) {
      setCurrent(outcome.product);
      reset(toValues(outcome.product, defaultSortOrder));
    }
  }

  const slugChanging = Boolean(current && slug !== current.slug);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-ink-950 text-2xl font-bold">
          {current ? current.name : "Add product"}
        </h1>
        <Link href="/admin/products" className="text-ink-700 text-sm underline underline-offset-4">
          Back to products
        </Link>
      </div>

      <div id={SUMMARY_ID} tabIndex={-1} aria-live="polite" className="outline-none">
        {result && !result.success ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900"
          >
            <AlertCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <div>
              <p>{result.message}</p>
              {result.code === "VERSION_CONFLICT" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => window.location.reload()}
                >
                  Reload
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        {result?.success ? (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
            <CheckCircle2Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p>{result.message}</p>
          </div>
        ) : null}
      </div>

      {current?.status === "archived" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p>This product is archived and hidden from the shop.</p>
          <Button type="button" size="sm" variant="outline" onClick={restore}>
            Restore
          </Button>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field id="name" label="Name" error={errors.name?.message}>
            <Input
              id="name"
              aria-invalid={Boolean(errors.name)}
              {...register("name", { onBlur: maybeSuggestSlug })}
            />
          </Field>
        </div>

        <Field id="category" label="Category" error={errors.category?.message}>
          <select id="category" className={SELECT_CLASS} {...register("category")}>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="status" label="Status" error={errors.status?.message}>
          <select id="status" className={SELECT_CLASS} {...register("status")}>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="strength" label="Vial size" error={errors.strength?.message}>
          <Input
            className="bg-white dark:bg-white"
            id="strength"
            type="number"
            inputMode="decimal"
            step="any"
            aria-invalid={Boolean(errors.strength)}
            {...register("strength", { valueAsNumber: true, onBlur: maybeSuggestSlug })}
          />
        </Field>

        <Field id="strengthUnit" label="Unit" error={errors.strengthUnit?.message}>
          <select
            id="strengthUnit"
            className={SELECT_CLASS}
            {...register("strengthUnit", { onChange: maybeSuggestSlug })}
          >
            <option value="mg">mg</option>
            <option value="ml">ml</option>
          </select>
        </Field>

        <Field
          id="price"
          label="Price (USD)"
          error={errors.price?.message}
          hint={`Cost per mg: ${costLabel}. Worked out from the price and vial size.`}
        >
          <Input
            className="bg-white dark:bg-white"
            id="price"
            type="number"
            inputMode="decimal"
            step="0.01"
            aria-invalid={Boolean(errors.price)}
            aria-describedby="price-hint"
            {...register("price", { valueAsNumber: true })}
          />
        </Field>

        <Field
          id="sortOrder"
          label="Display order"
          error={errors.sortOrder?.message}
          hint="Lower numbers come first. You can also reorder from the list."
        >
          <Input
            className="bg-white dark:bg-white"
            id="sortOrder"
            type="number"
            inputMode="numeric"
            step="1"
            aria-invalid={Boolean(errors.sortOrder)}
            aria-describedby="sortOrder-hint"
            {...register("sortOrder", { valueAsNumber: true })}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field
            id="slug"
            label="Web address"
            error={errors.slug?.message}
            hint={`Shown as /products/${slug || "…"}. Made from the name and vial size; edit it only if you need to.`}
          >
            <div className="flex gap-2">
              <Input
                id="slug"
                className="bg-white font-mono dark:bg-white"
                aria-invalid={Boolean(errors.slug)}
                aria-describedby="slug-hint"
                {...register("slug", {
                  onChange: () => {
                    setSlugEdited(true);
                  },
                })}
              />
              <Button type="button" variant="outline" onClick={suggestSlug}>
                Suggest
              </Button>
            </div>
          </Field>
          {slugChanging ? (
            <p className="mt-2 text-sm text-amber-900">
              Changing the web address keeps the old link working: it will redirect here. The new
              page takes a few minutes to go live.
            </p>
          ) : null}
          <p className="text-ink-600 mt-2 text-xs">
            A few older addresses are redirected by the site itself before products are checked, so
            do not reuse the address of a product that was renamed earlier.
          </p>
        </div>

        <div className="sm:col-span-2">
          <Field
            id="description"
            label="Description"
            error={errors.description?.message}
            hint={`Optional. Up to ${MAX_PRODUCT_DESCRIPTION_LENGTH} characters.`}
          >
            <Textarea
              id="description"
              rows={4}
              aria-describedby="description-hint"
              {...register("description")}
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Controller
            control={control}
            name="imageUrl"
            render={({ field }) => (
              <ProductImageField
                value={field.value}
                onChange={(url) => field.onChange(url)}
                productName={name}
                uploadEnabled={uploadEnabled}
              />
            )}
          />
          {errors.imageUrl?.message ? (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {errors.imageUrl.message}
            </p>
          ) : null}
        </div>

        <label className="flex items-center gap-3 text-sm font-medium sm:col-span-2">
          <input type="checkbox" className="size-4" {...register("featured")} />
          Featured: eligible for the home page
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isSubmitting || (Boolean(current) && !isDirty)}>
          {isSubmitting ? "Saving…" : current ? "Save changes" : "Add product"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/admin/products")}>
          {result?.success ? "Done" : "Cancel"}
        </Button>
      </div>
    </form>
  );
}

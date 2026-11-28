import { z } from "zod";

import { isProductImageReference } from "@/features/admin/products/utils/imageRules";
import { SLUG_PATTERN } from "@/lib/dynamodb/entities";
import { mediaBaseUrl } from "@/lib/env.client";

/**
 * The one product schema, used by the form in the browser and by the server action that
 * saves it (D35). Neither side trusts the other: the action parses again.
 *
 * Price is typed in dollars, because that is how staff think of it, and stored as integer
 * cents by the service. Cost per milligram is never an input: it is computed on save.
 */

export const PRODUCT_CATEGORIES = ["peptide", "blend", "cosmetic", "supply"] as const;
export const PRODUCT_STATUSES = ["active", "out_of_stock", "archived"] as const;
export const STRENGTH_UNITS = ["mg", "ml"] as const;

export const MAX_PRODUCT_NAME_LENGTH = 80;
export const MAX_PRODUCT_DESCRIPTION_LENGTH = 2000;
export const MAX_SORT_ORDER = 9999;
const MAX_PRICE_DOLLARS = 100_000;
const MAX_STRENGTH = 100_000;

/** True when a dollar amount has at most two decimals, so it converts to whole cents. */
function isWholeCents(dollars: number): boolean {
  return Math.abs(dollars * 100 - Math.round(dollars * 100)) < 1e-6;
}

export const productInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter the product name.")
    .max(MAX_PRODUCT_NAME_LENGTH, `Keep the name under ${MAX_PRODUCT_NAME_LENGTH} characters.`),
  slug: z
    .string()
    .trim()
    .min(1, "Enter a web address for the product.")
    .max(100, "Keep the web address under 100 characters.")
    .regex(SLUG_PATTERN, "Use lowercase letters and numbers, separated by single hyphens."),
  description: z
    .string()
    .trim()
    .max(
      MAX_PRODUCT_DESCRIPTION_LENGTH,
      `Keep the description under ${MAX_PRODUCT_DESCRIPTION_LENGTH} characters.`,
    )
    .optional(),
  category: z.enum(PRODUCT_CATEGORIES, { error: "Choose a category." }),
  strength: z
    .number({ error: "Enter the vial size as a number." })
    .positive("The vial size must be more than zero.")
    .max(MAX_STRENGTH, "That vial size is too large."),
  strengthUnit: z.enum(STRENGTH_UNITS, { error: "Choose mg or ml." }),
  price: z
    .number({ error: "Enter the price as a number." })
    .min(0, "The price cannot be negative.")
    .max(MAX_PRICE_DOLLARS, "That price is too large.")
    .refine(isWholeCents, "Use at most two decimal places."),
  status: z.enum(PRODUCT_STATUSES, { error: "Choose a status." }),
  featured: z.boolean(),
  sortOrder: z
    .number({ error: "Enter the display order as a whole number." })
    .int("Enter the display order as a whole number.")
    .min(0, "The display order cannot be negative.")
    .max(MAX_SORT_ORDER, `The display order cannot exceed ${MAX_SORT_ORDER}.`),
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => isProductImageReference(value, mediaBaseUrl),
      "That image address is not valid.",
    )
    .optional(),
});

export type ProductInput = z.infer<typeof productInputSchema>;

/** A partial change, used by the featured toggle, archive, restore and image replacement. */
export const productPatchSchema = productInputSchema.partial();
export type ProductPatch = z.infer<typeof productPatchSchema>;

/** Field errors in the shape the form shows, keyed by field name. */
export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    (errors[key] ??= []).push(issue.message);
  }

  return errors;
}

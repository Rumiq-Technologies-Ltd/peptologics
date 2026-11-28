import { describe, expect, it } from "vitest";

import { suggestProductSlug } from "@/features/admin/products/utils/productSlug";
import {
  productInputSchema,
  toFieldErrors,
} from "@/features/admin/products/validation/product.schema";

const VALID = {
  name: "BPC-157",
  slug: "bpc-157-10mg",
  category: "peptide",
  strength: 10,
  strengthUnit: "mg",
  price: 50,
  status: "active",
  featured: false,
  sortOrder: 10,
};

function messages(input: Record<string, unknown>): Record<string, string[]> {
  const parsed = productInputSchema.safeParse({ ...VALID, ...input });
  return parsed.success ? {} : toFieldErrors(parsed.error);
}

describe("productInputSchema", () => {
  it("accepts a complete product", () => {
    expect(productInputSchema.safeParse(VALID).success).toBe(true);
  });

  it("explains each problem in plain words", () => {
    expect(messages({ name: " " }).name?.[0]).toBe("Enter the product name.");
    expect(messages({ slug: "Not A Slug" }).slug?.[0]).toBe(
      "Use lowercase letters and numbers, separated by single hyphens.",
    );
    expect(messages({ strength: 0 }).strength?.[0]).toBe("The vial size must be more than zero.");
    expect(messages({ price: -5 }).price?.[0]).toBe("The price cannot be negative.");
    expect(messages({ category: "tablet" }).category?.[0]).toBe("Choose a category.");
    expect(messages({ strengthUnit: "g" }).strengthUnit?.[0]).toBe("Choose mg or ml.");
  });

  it("rejects a price that is not whole cents", () => {
    expect(messages({ price: 19.999 }).price?.[0]).toBe("Use at most two decimal places.");
    expect(messages({ price: 19.99 })).toEqual({});
    expect(messages({ price: 0.1 + 0.2 })).toEqual({});
  });

  it("rejects a fractional or out-of-range display order", () => {
    expect(messages({ sortOrder: 1.5 }).sortOrder).toBeDefined();
    expect(messages({ sortOrder: -1 }).sortOrder).toBeDefined();
    expect(messages({ sortOrder: 10000 }).sortOrder).toBeDefined();
  });

  it("accepts a site path or an https address for the image, nothing else", () => {
    expect(messages({ imageUrl: "/products/bpc-157-10mg.webp" })).toEqual({});
    expect(messages({ imageUrl: "https://media.example.com/products/a.webp" })).toEqual({});
    expect(messages({ imageUrl: "javascript:alert(1)" }).imageUrl).toBeDefined();
    expect(messages({ imageUrl: "http://example.com/a.webp" }).imageUrl).toBeDefined();
  });

  it("has no field for cost per milligram or the lock version", () => {
    const parsed = productInputSchema.parse({ ...VALID, cost_per_mg: 1, version: 5 });
    expect(parsed).not.toHaveProperty("cost_per_mg");
    expect(parsed).not.toHaveProperty("version");
  });
});

describe("suggestProductSlug", () => {
  it("joins the name and the vial size, like the catalog's own slugs", () => {
    expect(suggestProductSlug("BPC-157", 10, "mg")).toBe("bpc-157-10mg");
    expect(suggestProductSlug("Bacteriostatic Water", 10, "ml")).toBe("bacteriostatic-water-10ml");
    expect(suggestProductSlug("PL3", 30, "mg")).toBe("pl3-30mg");
  });

  it("copes with a missing size and decimals", () => {
    expect(suggestProductSlug("Elora", Number.NaN, "mg")).toBe("elora");
    expect(suggestProductSlug("Elora", 2.5, "mg")).toBe("elora-2-5mg");
  });
});

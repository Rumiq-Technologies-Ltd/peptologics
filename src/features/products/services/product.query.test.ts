import { describe, expect, it } from "vitest";

import {
  selectPublicProducts,
  type ProductRecord,
} from "@/features/products/services/product.query";

function record(
  overrides: Partial<ProductRecord> & Pick<ProductRecord, "id" | "name">,
): ProductRecord {
  return {
    slug: overrides.id,
    description: null,
    category: "peptide",
    strength_mg: 10,
    strength_unit: "mg",
    price_cents: 5000,
    cost_per_mg: 5,
    is_blend: false,
    featured: false,
    sort_order: 10,
    image_url: null,
    coa_url: null,
    status: "active",
    ...overrides,
  };
}

const catalog: ProductRecord[] = [
  record({ id: "bpc", name: "BPC-157", sort_order: 20, price_cents: 5000, cost_per_mg: 5 }),
  record({ id: "nad", name: "NAD+", sort_order: 110, price_cents: 5500, cost_per_mg: 0.11 }),
  record({ id: "ret", name: "PL3", sort_order: 10, price_cents: 18000, cost_per_mg: 6 }),
  record({
    id: "water",
    name: "Bacteriostatic Water",
    category: "supply",
    sort_order: 5,
    price_cents: 800,
    cost_per_mg: 2.6,
  }),
  record({ id: "old", name: "Retired", status: "archived" }),
  record({ id: "gone", name: "Deleted", deleted_at: "2026-01-01T00:00:00Z" }),
];

const ids = (records: ProductRecord[]) => records.map((r) => r.id);

describe("selectPublicProducts", () => {
  it("returns only active, non-deleted products", () => {
    expect(ids(selectPublicProducts(catalog))).not.toContain("old");
    expect(ids(selectPublicProducts(catalog))).not.toContain("gone");
    expect(selectPublicProducts(catalog)).toHaveLength(4);
  });

  it("sorts by recommended order by default", () => {
    expect(ids(selectPublicProducts(catalog))).toEqual(["water", "ret", "bpc", "nad"]);
  });

  it.each([
    ["name-asc", ["water", "bpc", "nad", "ret"]],
    ["price-asc", ["water", "bpc", "nad", "ret"]],
    ["price-desc", ["ret", "nad", "bpc", "water"]],
    ["value-asc", ["nad", "water", "bpc", "ret"]],
  ] as const)("sorts by %s", (sort, expected) => {
    expect(ids(selectPublicProducts(catalog, { sort }))).toEqual(expected);
  });

  it("filters by category", () => {
    expect(ids(selectPublicProducts(catalog, { category: "supply" }))).toEqual(["water"]);
  });

  it("searches names case-insensitively and treats wildcard characters literally", () => {
    expect(ids(selectPublicProducts(catalog, { search: "bpc" }))).toEqual(["bpc"]);
    expect(ids(selectPublicProducts(catalog, { search: "  WATER " }))).toEqual(["water"]);
    expect(selectPublicProducts(catalog, { search: "%" })).toEqual([]);
  });

  it("applies the limit after sorting and never mutates the input", () => {
    const before = ids(catalog);
    expect(ids(selectPublicProducts(catalog, { limit: 2 }))).toEqual(["water", "ret"]);
    expect(ids(catalog)).toEqual(before);
  });
});

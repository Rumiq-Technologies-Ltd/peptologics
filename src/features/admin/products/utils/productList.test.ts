import { describe, expect, it } from "vitest";

import type { AdminProduct } from "@/features/admin/products/types";
import {
  DEFAULT_FILTERS,
  canReorder,
  filterAndSortProducts,
  homePageProducts,
} from "@/features/admin/products/utils/productList";

function product(id: string, over: Partial<AdminProduct> = {}): AdminProduct {
  return {
    id,
    slug: `p-${id}-10mg`,
    name: `Product ${id}`,
    description: null,
    category: "peptide",
    strength: 10,
    strengthUnit: "mg",
    priceCents: 5000,
    costPerMg: 5,
    isBlend: false,
    featured: false,
    sortOrder: Number(id) * 10,
    imageUrl: null,
    status: "active",
    version: 1,
    previousSlugs: [],
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...over,
  };
}

const ALL = [
  product("3", { name: "Zeta", priceCents: 9000, category: "supply", status: "out_of_stock" }),
  product("1", { name: "Alpha", priceCents: 3000, featured: true }),
  product("2", { name: "Beta", priceCents: 6000, status: "archived", featured: true }),
];

const ids = (list: AdminProduct[]) => list.map((item) => item.id);

describe("filterAndSortProducts", () => {
  it("sorts by display order by default", () => {
    expect(ids(filterAndSortProducts(ALL, DEFAULT_FILTERS))).toEqual(["1", "2", "3"]);
  });

  it("searches name and web address, ignoring case", () => {
    expect(ids(filterAndSortProducts(ALL, { ...DEFAULT_FILTERS, search: "ALPH" }))).toEqual(["1"]);
    expect(ids(filterAndSortProducts(ALL, { ...DEFAULT_FILTERS, search: "p-3-" }))).toEqual(["3"]);
  });

  it("filters by status and category", () => {
    expect(ids(filterAndSortProducts(ALL, { ...DEFAULT_FILTERS, status: "archived" }))).toEqual([
      "2",
    ]);
    expect(ids(filterAndSortProducts(ALL, { ...DEFAULT_FILTERS, category: "supply" }))).toEqual([
      "3",
    ]);
  });

  it("sorts by name and by price", () => {
    expect(ids(filterAndSortProducts(ALL, { ...DEFAULT_FILTERS, sort: "name" }))).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(ids(filterAndSortProducts(ALL, { ...DEFAULT_FILTERS, sort: "price-desc" }))).toEqual([
      "3",
      "2",
      "1",
    ]);
    expect(ids(filterAndSortProducts(ALL, { ...DEFAULT_FILTERS, sort: "price-asc" }))).toEqual([
      "1",
      "2",
      "3",
    ]);
  });

  it("does not change its input", () => {
    const before = ids(ALL);
    filterAndSortProducts(ALL, { ...DEFAULT_FILTERS, sort: "price-desc" });
    expect(ids(ALL)).toEqual(before);
  });
});

describe("homePageProducts", () => {
  it("shows featured active products only, in order, at most three (D32)", () => {
    const many = [1, 2, 3, 4, 5].map((n) => product(String(n), { featured: true }));
    many.push(product("6", { featured: true, status: "archived", sortOrder: 5 }));

    expect(ids(homePageProducts(many))).toEqual(["1", "2", "3"]);
  });
});

describe("canReorder", () => {
  it("allows reordering only on the full list in display order", () => {
    expect(canReorder(DEFAULT_FILTERS)).toBe(true);
    expect(canReorder({ ...DEFAULT_FILTERS, search: "a" })).toBe(false);
    expect(canReorder({ ...DEFAULT_FILTERS, status: "active" })).toBe(false);
    expect(canReorder({ ...DEFAULT_FILTERS, sort: "name" })).toBe(false);
  });
});

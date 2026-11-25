import { describe, expect, it } from "vitest";

import {
  formatPresentation,
  formatProductTitle,
  hasComparableCostPerMg,
} from "@/features/products/utils/product.display";
import { makeProduct } from "@/test/factories";

/**
 * The rule these encode: a cost-per-milligram figure is only printed when it means
 * something. Both suppression cases reached production as display bugs on their own
 * surfaces before this predicate existed, so each has a test.
 */
describe("hasComparableCostPerMg", () => {
  it("is true for an ordinary single-compound vial", () => {
    expect(hasComparableCostPerMg(makeProduct())).toBe(true);
  });

  it("is false for a blend, where the figure spans several peptides", () => {
    expect(hasComparableCostPerMg(makeProduct({ isBlend: true }))).toBe(false);
  });

  it("is false for anything sold by volume, where the figure is meaningless", () => {
    const water = makeProduct({ strengthUnit: "ml", category: "supply" });
    expect(hasComparableCostPerMg(water)).toBe(false);
  });
});

describe("formatPresentation", () => {
  it("calls a powder lyophilized and a liquid a solution", () => {
    expect(formatPresentation(makeProduct())).toBe("lyophilized");
    expect(formatPresentation(makeProduct({ strengthUnit: "ml" }))).toBe("solution");
  });
});

describe("formatProductTitle", () => {
  const ten = makeProduct({ id: "a", name: "BPC-157", strengthMg: 10 });
  const twenty = makeProduct({ id: "b", name: "BPC-157", strengthMg: 20 });
  const single = makeProduct({ id: "c", name: "Elora", strengthMg: 5 });

  it("keeps the strength when the name is sold in more than one size", () => {
    expect(formatProductTitle(ten, [ten, twenty, single], "10 mg")).toBe("BPC-157 10 mg");
  });

  it("uses the name alone when the compound has a single size", () => {
    expect(formatProductTitle(single, [ten, twenty, single], "5 mg")).toBe("Elora");
  });
});

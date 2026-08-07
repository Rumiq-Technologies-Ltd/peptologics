import { describe, expect, it } from "vitest";

import { MAX_DISTINCT_LINES, MAX_LINE_QUANTITY, MIN_LINE_QUANTITY } from "@/constants/business";
import {
  calculateTotals,
  clampQuantity,
  countUnits,
  findQuantity,
  parsePersistedItems,
  resolveCartLines,
} from "@/features/cart/utils/cart.calculations";
import { makeProduct } from "@/test/factories";

/**
 * The inquiry list's arithmetic and its defences against a hand-edited
 * `localStorage` record.
 *
 * Everything here is a pure function, which is exactly why it is worth testing: these
 * are the rules that decide what a customer is quoted, and they can be exercised
 * without a browser, a store, or a database.
 */

describe("clampQuantity", () => {
  it("keeps a quantity that is already in range", () => {
    expect(clampQuantity(3)).toBe(3);
  });

  it("clamps above the maximum rather than rejecting", () => {
    expect(clampQuantity(250)).toBe(MAX_LINE_QUANTITY);
  });

  it("raises anything below the minimum, including zero and negatives", () => {
    expect(clampQuantity(0)).toBe(MIN_LINE_QUANTITY);
    expect(clampQuantity(-5)).toBe(MIN_LINE_QUANTITY);
  });

  it("truncates a fraction rather than rounding", () => {
    // 2.7 vials is not 3 vials. Truncating never quotes more than was asked for.
    expect(clampQuantity(2.7)).toBe(2);
  });

  it("treats any non-finite value as the minimum, including infinity", () => {
    // Infinity collapses to 1 rather than 99. A corrupt value should quote the least,
    // not the most — the same direction NaN fails in.
    expect(clampQuantity(Number.NaN)).toBe(MIN_LINE_QUANTITY);
    expect(clampQuantity(Number.POSITIVE_INFINITY)).toBe(MIN_LINE_QUANTITY);
    expect(clampQuantity(Number.NEGATIVE_INFINITY)).toBe(MIN_LINE_QUANTITY);
  });
});

describe("parsePersistedItems", () => {
  it("returns an empty list for anything that is not an array", () => {
    expect(parsePersistedItems(undefined)).toEqual([]);
    expect(parsePersistedItems(null)).toEqual([]);
    expect(parsePersistedItems("[]")).toEqual([]);
    expect(parsePersistedItems({ items: [] })).toEqual([]);
  });

  it("keeps valid entries and clamps their quantities", () => {
    expect(parsePersistedItems([{ productId: "abc", quantity: 250 }])).toEqual([
      { productId: "abc", quantity: MAX_LINE_QUANTITY },
    ]);
  });

  it("drops entries that are not shaped like an item", () => {
    const parsed = parsePersistedItems([
      "junk",
      42,
      null,
      { quantity: 2 },
      { productId: "", quantity: 1 },
      { productId: "abc", quantity: "2" },
      { productId: "valid", quantity: 1 },
    ]);

    expect(parsed).toEqual([{ productId: "valid", quantity: 1 }]);
  });

  it("drops a duplicate product id, which would otherwise double a subtotal", () => {
    const parsed = parsePersistedItems([
      { productId: "abc", quantity: 1 },
      { productId: "abc", quantity: 5 },
    ]);

    expect(parsed).toEqual([{ productId: "abc", quantity: 1 }]);
  });

  it("caps the number of distinct lines", () => {
    const oversized = Array.from({ length: MAX_DISTINCT_LINES + 10 }, (_, index) => ({
      productId: `product-${index}`,
      quantity: 1,
    }));

    expect(parsePersistedItems(oversized)).toHaveLength(MAX_DISTINCT_LINES);
  });

  it("rejects an implausibly long product id", () => {
    expect(parsePersistedItems([{ productId: "x".repeat(65), quantity: 1 }])).toEqual([]);
  });
});

describe("resolveCartLines", () => {
  const retatrutide = makeProduct({ name: "Retatrutide", priceCents: 6000 });
  const bpc = makeProduct({ name: "BPC-157", slug: "bpc-157-10mg", priceCents: 5000 });

  it("prices each line from the catalog, not from the stored item", () => {
    const lines = resolveCartLines([{ productId: retatrutide.id, quantity: 3 }], [retatrutide]);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.lineTotalCents).toBe(18_000);
  });

  it("drops a product that is no longer in the catalog", () => {
    // The archived-product case: the store holds an id, the catalog no longer does, so
    // there is nothing to render it from and the line disappears (ADR-010).
    const lines = resolveCartLines(
      [
        { productId: retatrutide.id, quantity: 1 },
        { productId: "withdrawn-product-id", quantity: 4 },
      ],
      [retatrutide],
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]?.product.id).toBe(retatrutide.id);
  });

  it("preserves the order the visitor built the list in", () => {
    const lines = resolveCartLines(
      [
        { productId: bpc.id, quantity: 1 },
        { productId: retatrutide.id, quantity: 1 },
      ],
      // Catalog order is deliberately the reverse of the stored order.
      [retatrutide, bpc],
    );

    expect(lines.map((line) => line.product.name)).toEqual(["BPC-157", "Retatrutide"]);
  });

  it("clamps a stored quantity that is out of range", () => {
    const lines = resolveCartLines([{ productId: retatrutide.id, quantity: 9999 }], [retatrutide]);

    expect(lines[0]?.quantity).toBe(MAX_LINE_QUANTITY);
    expect(lines[0]?.lineTotalCents).toBe(6000 * MAX_LINE_QUANTITY);
  });

  it("returns nothing when either side is empty", () => {
    expect(resolveCartLines([], [retatrutide])).toEqual([]);
    expect(resolveCartLines([{ productId: retatrutide.id, quantity: 1 }], [])).toEqual([]);
  });
});

describe("calculateTotals", () => {
  it("sums lines and units exactly, with no floating point anywhere", () => {
    const a = makeProduct({ priceCents: 6000 });
    const b = makeProduct({ priceCents: 5500, slug: "nad-500mg" });

    const lines = resolveCartLines(
      [
        { productId: a.id, quantity: 3 },
        { productId: b.id, quantity: 2 },
      ],
      [a, b],
    );

    expect(calculateTotals(lines)).toEqual({
      lineCount: 2,
      unitCount: 5,
      subtotalCents: 29_000,
    });

    expect(Number.isInteger(calculateTotals(lines).subtotalCents)).toBe(true);
  });

  it("reports zeroes for an empty list", () => {
    expect(calculateTotals([])).toEqual({ lineCount: 0, unitCount: 0, subtotalCents: 0 });
  });
});

describe("findQuantity and countUnits", () => {
  const items = [
    { productId: "a", quantity: 2 },
    { productId: "b", quantity: 3 },
  ];

  it("finds a quantity, and reports zero for a product that is not on the list", () => {
    expect(findQuantity(items, "b")).toBe(3);
    expect(findQuantity(items, "missing")).toBe(0);
  });

  it("counts units across every line", () => {
    expect(countUnits(items)).toBe(5);
    expect(countUnits([])).toBe(0);
  });
});

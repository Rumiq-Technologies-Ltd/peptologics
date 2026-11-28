import { describe, expect, it } from "vitest";

import { isProductImageReference } from "@/features/admin/products/utils/imageRules";

const BASE = "https://media.example.com";

describe("isProductImageReference", () => {
  it("accepts /products/<file> site paths", () => {
    expect(isProductImageReference("/products/pl3-10mg.webp", undefined)).toBe(true);
    expect(isProductImageReference("/products/a_b-c.1.png", BASE)).toBe(true);
  });

  it("accepts the media base plus /products/<file>", () => {
    expect(isProductImageReference(`${BASE}/products/11111111-1111.webp`, BASE)).toBe(true);
  });

  it("refuses every https address when no media base is configured", () => {
    expect(isProductImageReference(`${BASE}/products/x.webp`, undefined)).toBe(false);
    expect(isProductImageReference("https://anything.example.com/products/x.webp", undefined)).toBe(
      false,
    );
  });

  it("refuses protocol-relative, nested, empty, dot and traversal names", () => {
    for (const bad of [
      "//evil.example.com/x.webp",
      "//evil.example.com/products/x.webp",
      "/products//x.webp",
      "/products/",
      "/products/.",
      "/products/..",
      "/products/..%2Fx",
      "/products/a/b.webp",
      "/products/a b.webp",
      `${BASE}/products/`,
      `${BASE}/products/../x`,
      `${BASE}/products/a/b.webp`,
      `${BASE}x/products/a.webp`,
      "",
    ]) {
      expect(isProductImageReference(bad, BASE), bad).toBe(false);
    }
  });
});

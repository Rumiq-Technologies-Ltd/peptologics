import { beforeEach, describe, expect, it, vi } from "vitest";

import { FEATURED_PRODUCT_LIMIT } from "@/constants/business";
import type { ProductRepository } from "@/features/products/services/product.repository";
import { createProductService } from "@/features/products/services/product.service";
import { makeProduct } from "@/test/factories";

/**
 * Catalog business rules.
 *
 * The repository is a fake, because what is under test is the *decisions* — which sort
 * to honour, how far to trust a search term from a URL, what to show when nothing is
 * flagged featured. How the rows are fetched is the repository's business and was
 * verified against the real database in Phase 2.
 */

/**
 * Each fake is typed from the repository interface it stands in for, so the compiler
 * checks the arguments a test asserts on. An untyped `vi.fn()` infers its signature from
 * the stub body — `mock.calls[0][0]` then has no type at all, and a test can assert
 * against a shape the real repository never receives.
 */
function makeHarness() {
  const findActive = vi.fn<ProductRepository["findActive"]>(async () => [makeProduct()]);
  const findFeatured = vi.fn<ProductRepository["findFeatured"]>(async () => [
    makeProduct({ featured: true }),
  ]);
  const findBySlug = vi.fn<ProductRepository["findBySlug"]>(async () => makeProduct());
  const findByIds = vi.fn<ProductRepository["findByIds"]>(async () => []);
  const listActiveSlugs = vi.fn<ProductRepository["listActiveSlugs"]>(async () => [
    { slug: "pl3-10mg", updatedAt: "2026-08-01" },
  ]);

  const findCurrentSlugForRetired = vi.fn<ProductRepository["findCurrentSlugForRetired"]>(
    async () => null,
  );

  const repository: ProductRepository = {
    findCurrentSlugForRetired,
    findActive,
    findFeatured,
    findBySlug,
    findByIds,
    listActiveSlugs,
  };

  return {
    service: createProductService({ repository }),
    findActive,
    findFeatured,
    findBySlug,
    listActiveSlugs,
    findCurrentSlugForRetired,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveSort", () => {
  it.each(["recommended", "name-asc", "price-asc", "price-desc", "value-asc"] as const)(
    "honours the supported sort %s",
    (sort) => {
      expect(makeHarness().service.resolveSort(sort)).toBe(sort);
    },
  );

  it.each([
    ["junk", "totally-made-up"],
    ["an injection attempt", "name; drop table products"],
    ["nothing at all", undefined],
  ])("falls back to recommended for %s", (_label, value) => {
    // The value comes from a URL and is untrusted, so an unknown sort degrades rather
    // than erroring.
    expect(makeHarness().service.resolveSort(value)).toBe("recommended");
  });
});

describe("listActive", () => {
  it("sanitises a search term before it reaches the repository", async () => {
    const { service, findActive } = makeHarness();

    await service.listActive({ search: "  pl​3  " });

    expect(findActive).toHaveBeenCalledWith(expect.objectContaining({ search: "pl3" }));
  });

  it("caps an absurdly long search term", async () => {
    const { service, findActive } = makeHarness();

    await service.listActive({ search: "x".repeat(500) });

    expect(findActive.mock.calls[0]?.[0]?.search).toHaveLength(60);
  });

  it("treats a search that sanitises to nothing as no filter at all", async () => {
    const { service, findActive } = makeHarness();

    await service.listActive({ search: "   " });

    expect(findActive).toHaveBeenCalledWith(expect.objectContaining({ search: undefined }));
  });

  it("returns a failure with a safe message when the repository throws", async () => {
    const { service, findActive } = makeHarness();
    findActive.mockRejectedValueOnce(new Error('relation "products" does not exist'));

    const result = await service.listActive();

    expect(result.success).toBe(false);
    expect(result.success === false && result.code).toBe("UNEXPECTED");
    expect(result.success === false && result.message).not.toContain("relation");
  });
});

describe("listFeatured", () => {
  it("returns the featured set when there is one", async () => {
    const { service, findActive } = makeHarness();

    const result = await service.listFeatured();

    expect(result.success && result.data).toHaveLength(1);
    expect(findActive).not.toHaveBeenCalled();
  });

  it("never returns more than FEATURED_PRODUCT_LIMIT, even if the repository does", async () => {
    // The home page renders one card per product returned, so the cap lives here.
    const { service, findFeatured, findActive } = makeHarness();
    const many = Array.from({ length: FEATURED_PRODUCT_LIMIT + 4 }, (_, index) =>
      makeProduct({ id: `featured-${index}`, slug: `featured-${index}` }),
    );
    findFeatured.mockResolvedValueOnce(many);

    const featured = await service.listFeatured();

    expect(featured.success && featured.data).toHaveLength(FEATURED_PRODUCT_LIMIT);
    expect(featured.success && featured.data.map((product) => product.id)).toEqual(
      many.slice(0, FEATURED_PRODUCT_LIMIT).map((product) => product.id),
    );

    findFeatured.mockResolvedValueOnce([]);
    findActive.mockResolvedValueOnce(many);
    const fallback = await service.listFeatured();
    expect(fallback.success && fallback.data).toHaveLength(FEATURED_PRODUCT_LIMIT);
  });

  it("falls back to the top of the default order when nothing is flagged", async () => {
    // Otherwise the home page ships with an empty section, which is worse than showing
    // the first few products.
    const { service, findFeatured, findActive } = makeHarness();
    findFeatured.mockResolvedValueOnce([]);

    const result = await service.listFeatured();

    expect(result.success).toBe(true);
    expect(findActive).toHaveBeenCalledWith({
      sort: "recommended",
      limit: FEATURED_PRODUCT_LIMIT,
    });
  });
});

describe("getBySlug", () => {
  it("rejects a malformed slug without spending a query", async () => {
    const { service, findBySlug } = makeHarness();

    const result = await service.getBySlug("../../etc/passwd");

    expect(result.success === false && result.code).toBe("NOT_FOUND");
    expect(findBySlug).not.toHaveBeenCalled();
  });

  it("reports NOT_FOUND for a well-formed slug with no row", async () => {
    const { service, findBySlug } = makeHarness();
    findBySlug.mockResolvedValueOnce(null);

    const result = await service.getBySlug("no-such-product");

    expect(result.success === false && result.code).toBe("NOT_FOUND");
  });
});

describe("listSlugsForSitemap", () => {
  it("returns an empty list rather than throwing, so a sitemap cannot break a deploy", async () => {
    const { service, listActiveSlugs } = makeHarness();
    listActiveSlugs.mockRejectedValueOnce(new Error("connection reset"));

    await expect(service.listSlugsForSitemap()).resolves.toEqual([]);
  });
});

describe("retired slugs (D26)", () => {
  it("returns where a retired slug now lives", async () => {
    const { service, findCurrentSlugForRetired } = makeHarness();
    findCurrentSlugForRetired.mockResolvedValueOnce("pl3-30mg");

    await expect(service.resolveRetiredSlug("old-30mg")).resolves.toBe("pl3-30mg");
  });

  it("does not look up a malformed slug", async () => {
    const { service, findCurrentSlugForRetired } = makeHarness();

    await expect(service.resolveRetiredSlug("../etc/passwd")).resolves.toBeNull();
    expect(findCurrentSlugForRetired).not.toHaveBeenCalled();
  });

  it("degrades to no redirect when the lookup fails, rather than erroring the page", async () => {
    const { service, findCurrentSlugForRetired } = makeHarness();
    findCurrentSlugForRetired.mockRejectedValueOnce(new Error("down"));

    await expect(service.resolveRetiredSlug("old-30mg")).resolves.toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The product page's status codes (ADR-039). The page is rendered on every request, so these
 * are the answers a visitor, a search engine and CloudFront get: a product that is archived or
 * unknown is a real 404 and a retired address is a permanent redirect.
 */

const mocks = vi.hoisted(() => ({
  getBySlug: vi.fn(),
  resolveRetiredSlug: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  permanentRedirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:308:${path}`);
  },
}));
vi.mock("@/services/container", () => ({
  getContainer: () => ({
    products: {
      getBySlug: mocks.getBySlug,
      resolveRetiredSlug: mocks.resolveRetiredSlug,
      listActive: vi.fn(),
    },
  }),
}));

import * as page from "@/app/(site)/products/[slug]/page";

const props = (slug: string) => ({ params: Promise.resolve({ slug }) }) as never;
const notFoundResult = { success: false, code: "NOT_FOUND", message: "No such product." };

beforeEach(() => vi.clearAllMocks());

describe("product page route config", () => {
  it("is rendered on every request, so no edge cache can keep a stale copy", () => {
    expect(page.dynamic).toBe("force-dynamic");
    // None of the static-rendering settings may come back: each would let CloudFront hold the
    // page (s-maxage) and serve a 200 for an archived product.
    expect("revalidate" in page).toBe(false);
    expect("generateStaticParams" in page).toBe(false);
    expect("dynamicParams" in page).toBe(false);
  });
});

describe("product page status codes", () => {
  it("is a 404 for an unknown or archived product", async () => {
    mocks.getBySlug.mockResolvedValue(notFoundResult);
    mocks.resolveRetiredSlug.mockResolvedValue(null);

    await expect(page.default(props("never-existed-5mg"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("is a permanent redirect for a retired slug", async () => {
    mocks.getBySlug.mockResolvedValue(notFoundResult);
    mocks.resolveRetiredSlug.mockResolvedValue("renamed-5mg");

    await expect(page.default(props("old-5mg"))).rejects.toThrow(
      "NEXT_REDIRECT:308:/products/renamed-5mg",
    );
  });

  it("does not look for a redirect when the product exists", async () => {
    mocks.getBySlug.mockResolvedValue({ success: false, code: "UNEXPECTED", message: "down" });

    await expect(page.default(props("bpc-157-10mg"))).rejects.toThrow("down");
    expect(mocks.resolveRetiredSlug).not.toHaveBeenCalled();
  });
});

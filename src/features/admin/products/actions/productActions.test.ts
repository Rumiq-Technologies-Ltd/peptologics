import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidateCatalog: vi.fn(),
  recordAudit: vi.fn(),
  products: {
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    reorder: vi.fn(),
  },
  rebuild: { request: vi.fn() },
  images: { createUploadTicket: vi.fn(), finalizeUpload: vi.fn() } as {
    createUploadTicket: ReturnType<typeof vi.fn>;
    finalizeUpload: ReturnType<typeof vi.fn>;
  } | null,
}));

vi.mock("@/lib/admin/authorize.server", () => ({
  requireAdmin: mocks.requireAdmin,
  requestId: async () => "req-1",
}));
vi.mock("@/features/admin/products/actions/revalidateCatalog", () => ({
  revalidateCatalog: mocks.revalidateCatalog,
}));
vi.mock("@/features/admin/services/audit.service", () => ({ recordAudit: mocks.recordAudit }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/features/admin/products/services/container.server", () => ({
  getProductAdmin: () => ({
    products: mocks.products,
    rebuild: mocks.rebuild,
    images: mocks.images,
  }),
}));

import {
  createProductAction,
  finalizeImageUploadAction,
  publishPendingPagesAction,
  reorderProductAction,
  requestImageUploadAction,
  setProductFeaturedAction,
  setProductStatusAction,
  updateProductAction,
} from "@/features/admin/products/actions/productActions";
import type { AdminProduct, ProductChangeOutcome } from "@/features/admin/products/types";

const ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT = { id: ID, slug: "new-5mg", name: "New", version: 2 } as AdminProduct;

function outcome(over: Partial<ProductChangeOutcome> = {}) {
  return {
    success: true as const,
    data: {
      product: PRODUCT,
      changedFields: ["name"],
      staleSlugs: [],
      needsBuild: false,
      ...over,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ email: "editor@example.com", role: "editor" });
  mocks.rebuild.request.mockResolvedValue("triggered");
});

describe("access", () => {
  it("every action needs an editor, from our own origin, before it does anything", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(createProductAction({})).rejects.toThrow("NEXT_REDIRECT");
    await expect(reorderProductAction(ID, "up")).rejects.toThrow("NEXT_REDIRECT");
    await expect(requestImageUploadAction({ contentType: "image/png", size: 1 })).rejects.toThrow();

    expect(mocks.products.create).not.toHaveBeenCalled();
    expect(mocks.products.reorder).not.toHaveBeenCalled();

    mocks.requireAdmin.mockResolvedValue({ email: "e@example.com", role: "editor" });
    mocks.products.create.mockResolvedValue(outcome({ needsBuild: true }));
    await createProductAction({});
    expect(mocks.requireAdmin).toHaveBeenLastCalledWith({ role: "editor", mutating: true });
  });

  it("hands the signed-in person and request to the service for the audit log", async () => {
    mocks.products.create.mockResolvedValue(outcome({ needsBuild: true }));

    await createProductAction({ name: "x" });

    expect(mocks.products.create).toHaveBeenCalledWith(
      { name: "x" },
      { email: "editor@example.com", role: "editor", requestId: "req-1" },
    );
  });
});

describe("create", () => {
  it("refreshes the site and asks for a build, then says when the page goes live", async () => {
    mocks.products.create.mockResolvedValue(outcome({ needsBuild: true }));

    const result = await createProductAction({});

    expect(mocks.revalidateCatalog).toHaveBeenCalledWith(["new-5mg"]);
    expect(mocks.rebuild.request).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      success: true,
      message: "Saved. The product page goes live in about 5 minutes.",
    });
  });

  it("still succeeds when the build request fails, and says the page waits for the next deploy", async () => {
    mocks.products.create.mockResolvedValue(outcome({ needsBuild: true }));
    mocks.rebuild.request.mockResolvedValue("failed");

    const result = await createProductAction({});

    expect(result).toMatchObject({
      success: true,
      message: "Saved. The page will go live after the next deploy.",
    });
  });

  it("says the same when the build was deferred by the two-minute window", async () => {
    mocks.products.create.mockResolvedValue(outcome({ needsBuild: true }));
    mocks.rebuild.request.mockResolvedValue("deferred");

    expect(await createProductAction({})).toMatchObject({
      message: "Saved. The page will go live after the next deploy.",
    });
  });

  it("passes the service's field errors straight back and refreshes nothing", async () => {
    mocks.products.create.mockResolvedValue({
      success: false,
      code: "SLUG_TAKEN",
      message: "That web address is already used by another product.",
      fieldErrors: { slug: ["taken"] },
    });

    const result = await createProductAction({});

    expect(result).toMatchObject({
      success: false,
      code: "SLUG_TAKEN",
      fieldErrors: { slug: ["taken"] },
    });
    expect(mocks.revalidateCatalog).not.toHaveBeenCalled();
    expect(mocks.rebuild.request).not.toHaveBeenCalled();
  });
});

describe("update", () => {
  it("refreshes only: no build for an ordinary edit", async () => {
    mocks.products.update.mockResolvedValue(outcome());

    const result = await updateProductAction(ID, 1, { price: 5 });

    expect(mocks.revalidateCatalog).toHaveBeenCalledWith(["new-5mg"]);
    expect(mocks.rebuild.request).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, message: "Saved." });
  });

  it("refreshes the old address too, and asks for a build, when the slug changes", async () => {
    mocks.products.update.mockResolvedValue(outcome({ staleSlugs: ["old-5mg"], needsBuild: true }));

    await updateProductAction(ID, 1, { slug: "new-5mg" });

    expect(mocks.revalidateCatalog).toHaveBeenCalledWith(["new-5mg", "old-5mg"]);
    expect(mocks.rebuild.request).toHaveBeenCalledOnce();
  });

  it("says when there was nothing to save", async () => {
    mocks.products.update.mockResolvedValue(outcome({ changedFields: [] }));

    expect(await updateProductAction(ID, 1, {})).toMatchObject({
      success: true,
      message: "Nothing to save: no changes.",
    });
    expect(mocks.revalidateCatalog).not.toHaveBeenCalled();
  });

  it("reports the version conflict in the owner's words", async () => {
    mocks.products.update.mockResolvedValue({
      success: false,
      code: "VERSION_CONFLICT",
      message: "This product changed since you opened it. Reload.",
    });

    expect(await updateProductAction(ID, 1, {})).toMatchObject({
      success: false,
      code: "VERSION_CONFLICT",
      message: "This product changed since you opened it. Reload.",
    });
  });

  it("rejects an id or version that is not valid without calling the service", async () => {
    expect(await updateProductAction("not-an-id", 1, {})).toMatchObject({ success: false });
    expect(await updateProductAction(ID, -1, {})).toMatchObject({ success: false });
    expect(await updateProductAction(ID, 1.5, {})).toMatchObject({ success: false });
    expect(mocks.products.update).not.toHaveBeenCalled();
  });
});

describe("archive, restore, featured and reorder", () => {
  it("archives, and tells staff it can be restored", async () => {
    mocks.products.archive.mockResolvedValue(outcome());

    const result = await setProductStatusAction(ID, 2, "archived");

    expect(mocks.products.archive).toHaveBeenCalledWith(ID, 2, expect.any(Object));
    expect(mocks.revalidateCatalog).toHaveBeenCalled();
    expect(mocks.rebuild.request).not.toHaveBeenCalled();
    expect(result).toMatchObject({ message: expect.stringContaining("can be restored") });
  });

  it("restores", async () => {
    mocks.products.restore.mockResolvedValue(outcome());

    expect(await setProductStatusAction(ID, 2, "active")).toMatchObject({
      success: true,
      message: "Restored. The product is back in the shop.",
    });
  });

  it("toggles featured through the same save path", async () => {
    mocks.products.update.mockResolvedValue(outcome());

    await setProductFeaturedAction(ID, 2, true);

    expect(mocks.products.update).toHaveBeenCalledWith(
      ID,
      { featured: true },
      2,
      expect.any(Object),
    );
  });

  it("reorders, refreshing the pages of every product that moved", async () => {
    mocks.products.reorder.mockResolvedValue({
      success: true,
      data: { moved: true, slugs: ["a", "b"] },
    });

    expect(await reorderProductAction(ID, "down")).toMatchObject({ success: true });
    expect(mocks.revalidateCatalog).toHaveBeenCalledWith(["a", "b"]);
  });

  it("refuses a direction that is not up or down", async () => {
    expect(await reorderProductAction(ID, "sideways" as never)).toMatchObject({ success: false });
    expect(mocks.products.reorder).not.toHaveBeenCalled();
  });
});

describe("images", () => {
  beforeEach(() => {
    mocks.images = { createUploadTicket: vi.fn(), finalizeUpload: vi.fn() };
  });

  it("checks type and size again before asking for a ticket", async () => {
    expect(await requestImageUploadAction({ contentType: "image/gif", size: 10 })).toMatchObject({
      success: false,
    });
    expect(
      await requestImageUploadAction({ contentType: "image/png", size: 6_000_000 }),
    ).toMatchObject({
      success: false,
    });
    expect(mocks.images?.createUploadTicket).not.toHaveBeenCalled();
  });

  it("returns a ticket for a valid request", async () => {
    mocks.images?.createUploadTicket.mockResolvedValue({
      success: true,
      data: { key: "uploads/x", url: "https://s3/x", headers: {} },
    });

    expect(await requestImageUploadAction({ contentType: "image/png", size: 1000 })).toMatchObject({
      success: true,
      key: "uploads/x",
    });
  });

  it("logs product_image_uploaded after a checked image is stored", async () => {
    mocks.images?.finalizeUpload.mockResolvedValue({
      success: true,
      data: { imageUrl: "https://media.example.com/products/x.webp", key: "products/x.webp" },
    });

    const result = await finalizeImageUploadAction("uploads/abc");

    expect(result).toEqual({
      success: true,
      imageUrl: "https://media.example.com/products/x.webp",
    });
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "product_image_uploaded",
        actorEmail: "editor@example.com",
      }),
    );
  });

  it("logs nothing when the image is refused", async () => {
    mocks.images?.finalizeUpload.mockResolvedValue({
      success: false,
      message: "The image must be square, or very nearly square.",
    });

    expect(await finalizeImageUploadAction("uploads/abc")).toMatchObject({ success: false });
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("explains when no bucket is configured", async () => {
    mocks.images = null;
    expect(await requestImageUploadAction({ contentType: "image/png", size: 1 })).toMatchObject({
      success: false,
      message: "Image upload is not set up in this environment.",
    });
  });
});

describe("publish now", () => {
  it("starts a build when the window allows it", async () => {
    expect(await publishPendingPagesAction()).toMatchObject({ success: true });
    expect(mocks.rebuild.request).toHaveBeenCalledWith("manual");
  });

  it("asks staff to wait when a build just started", async () => {
    mocks.rebuild.request.mockResolvedValue("deferred");
    expect(await publishPendingPagesAction()).toMatchObject({
      success: false,
      message: "A build was started a moment ago. Try again in two minutes.",
    });
  });
});

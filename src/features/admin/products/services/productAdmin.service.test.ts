import { beforeEach, describe, expect, it, vi } from "vitest";

// The audit module reaches DynamoDB and the logger; only its pure builder is used here.
vi.mock("@/features/admin/services/audit.repository.dynamodb", () => ({ putAuditEntry: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import {
  createProductAdminService,
  diffProduct,
  type ProductAdminService,
} from "@/features/admin/products/services/productAdmin.service";
import {
  ProductWriteConflict,
  type ProductAdminRepository,
  type WriteStep,
} from "@/features/admin/products/services/productAdmin.repository";
import type { AdminActor } from "@/features/admin/products/types";
import type { ProductInput } from "@/features/admin/products/validation/product.schema";
import { buildProductItems, type Item, type ProductSource } from "@/lib/dynamodb/entities";

const ACTOR: AdminActor = { email: "editor@example.com", role: "editor", requestId: "req-1" };
const NOW = new Date("2026-11-28T12:00:00.000Z");

function source(id: string, over: Partial<ProductSource> = {}): ProductSource {
  return {
    id,
    slug: `product-${id}-10mg`,
    name: `Product ${id}`,
    category: "peptide",
    strength_mg: 10,
    strength_unit: "mg",
    price_cents: 5000,
    is_blend: false,
    featured: false,
    sort_order: Number(id) * 10,
    status: "active",
    version: 1,
    created_at: "2026-11-01T00:00:00.000Z",
    ...over,
  };
}

/** An in-memory table that applies the same conditions DynamoDB would, for the ones the service uses. */
class FakeRepository implements ProductAdminRepository {
  items = new Map<string, Item>();
  commits: WriteStep[][] = [];
  failNextWith: ProductWriteConflict | null = null;

  seed(product: ProductSource): void {
    for (const item of buildProductItems(product, "2026-11-01T00:00:00.000Z")) this.put(item);
  }

  private put(item: Item): void {
    this.items.set(`${item.PK}|${item.SK}`, item);
  }

  async listItems(): Promise<Item[]> {
    return [...this.items.values()].filter((item) => item.entity === "product");
  }

  async getItem(id: string): Promise<Item | null> {
    return this.items.get(`PRODUCT#${id}|META`) ?? null;
  }

  async commit(steps: readonly WriteStep[]): Promise<void> {
    if (this.failNextWith) {
      const error = this.failNextWith;
      this.failNextWith = null;
      throw error;
    }

    for (const step of steps) {
      const existing = this.items.get(`${step.item.PK}|${step.item.SK}`);
      const expression = step.condition?.expression;
      const values = step.condition?.values ?? {};
      let allowed = true;

      if (expression === "attribute_not_exists(PK)") allowed = !existing;
      else if (expression?.startsWith("attribute_not_exists(PK) OR product_id"))
        allowed = !existing || existing.product_id === values[":pid"];
      else if (expression === "#v = :v") allowed = existing?.version === values[":v"];
      else if (expression === "attribute_not_exists(#v)") allowed = existing?.version === undefined;

      if (!allowed) throw new ProductWriteConflict(step.onConflict ?? "exists");
    }

    this.commits.push([...steps]);
    for (const step of steps) this.put(step.item);
  }

  auditItems(): Item[] {
    return [...this.items.values()].filter((item) => item.entity === "audit");
  }
}

const VALID: ProductInput = {
  name: "BPC-157",
  slug: "bpc-157-5mg",
  description: "",
  category: "peptide",
  strength: 5,
  strengthUnit: "mg",
  price: 42.5,
  status: "active",
  featured: false,
  sortOrder: 100,
};

let repo: FakeRepository;
let service: ProductAdminService;
let nextId: number;

beforeEach(() => {
  repo = new FakeRepository();
  nextId = 1;
  service = createProductAdminService({
    repository: repo,
    now: () => NOW,
    newId: () => `new-${nextId++}`,
    isAllowedImageUrl: (url) => url.startsWith("/products/"),
  });
});

describe("create", () => {
  it("writes the product, its slug guard and an audit item in one change", async () => {
    const result = await service.create(VALID, ACTOR);

    expect(result.success).toBe(true);
    expect(repo.commits).toHaveLength(1);
    expect(repo.commits[0]).toHaveLength(3);

    const product = repo.items.get("PRODUCT#new-1|META");
    expect(product).toMatchObject({
      slug: "bpc-157-5mg",
      price_cents: 4250,
      cost_per_mg: 8.5,
      version: 1,
      is_blend: false,
    });
    expect(repo.items.get("SLUG#bpc-157-5mg|GUARD")).toMatchObject({ product_id: "new-1" });
    expect(repo.auditItems()[0]).toMatchObject({
      action: "product_created",
      target: "new-1",
      actor_email: "editor@example.com",
      request_id: "req-1",
    });
  });

  it("never trusts a computed field from the caller", async () => {
    await service.create({ ...VALID, cost_per_mg: 1, version: 99 }, ACTOR);
    expect(repo.items.get("PRODUCT#new-1|META")).toMatchObject({ cost_per_mg: 8.5, version: 1 });
  });

  it("marks a blend by its category", async () => {
    await service.create({ ...VALID, category: "blend" }, ACTOR);
    expect(repo.items.get("PRODUCT#new-1|META")?.is_blend).toBe(true);
  });

  it("refuses a slug another product already has", async () => {
    repo.seed(source("1", { slug: "bpc-157-5mg" }));

    const result = await service.create(VALID, ACTOR);

    expect(result).toMatchObject({ success: false, code: "SLUG_TAKEN" });
    expect(repo.auditItems()).toHaveLength(0);
  });

  it("returns field errors for invalid input and writes nothing", async () => {
    const result = await service.create({ ...VALID, name: "", price: -1, slug: "Bad Slug" }, ACTOR);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(result.fieldErrors ?? {})).toEqual(
      expect.arrayContaining(["name", "price", "slug"]),
    );
    expect(repo.commits).toHaveLength(0);
  });

  it("rejects an image address from outside the image store", async () => {
    const result = await service.create(
      { ...VALID, imageUrl: "https://evil.example/x.webp" },
      ACTOR,
    );
    expect(result).toMatchObject({ success: false, code: "VALIDATION_FAILED" });
  });
});

describe("update", () => {
  beforeEach(() => repo.seed(source("1")));

  it("logs each changed field as before and after, price in cents", async () => {
    const result = await service.update("1", { price: 60, name: "Renamed" }, 1, ACTOR);

    expect(result.success).toBe(true);
    expect(repo.items.get("PRODUCT#1|META")).toMatchObject({
      name: "Renamed",
      price_cents: 6000,
      cost_per_mg: 6,
      version: 2,
      updated_at: NOW.toISOString(),
    });
    expect(repo.auditItems()[0]).toMatchObject({
      action: "product_updated",
      changes: {
        name: { from: "Product 1", to: "Renamed" },
        priceCents: { from: 5000, to: 6000 },
      },
    });
  });

  it("changes nothing and logs nothing when nothing differs", async () => {
    const result = await service.update("1", { name: "Product 1" }, 1, ACTOR);

    expect(result).toMatchObject({ success: true, data: { changedFields: [] } });
    expect(repo.commits).toHaveLength(0);
  });

  it("refuses a stale version: someone else saved first", async () => {
    const result = await service.update("1", { price: 70 }, 0, ACTOR);

    expect(result).toMatchObject({ success: false, code: "VERSION_CONFLICT" });
    expect(result.success ? "" : result.message).toBe(
      "This product changed since you opened it. Reload.",
    );
    expect(repo.items.get("PRODUCT#1|META")?.price_cents).toBe(5000);
  });

  it("also refuses when the version moves between the read and the write", async () => {
    repo.failNextWith = new ProductWriteConflict("version");

    const result = await service.update("1", { price: 70 }, 1, ACTOR);

    expect(result).toMatchObject({ success: false, code: "VERSION_CONFLICT" });
  });

  it("treats a product copied from Supabase (no version) as version 0", async () => {
    repo.seed(source("2", { version: undefined }));
    const stored = repo.items.get("PRODUCT#2|META");
    delete stored?.version;

    const result = await service.update("2", { price: 70 }, 0, ACTOR);

    expect(result.success).toBe(true);
    expect(repo.items.get("PRODUCT#2|META")?.version).toBe(1);
  });

  it("reports an unknown product", async () => {
    expect(await service.update("missing", { price: 1 }, 1, ACTOR)).toMatchObject({
      success: false,
      code: "NOT_FOUND",
    });
  });

  it("keeps the old address as a redirect when the slug changes", async () => {
    const result = await service.update("1", { slug: "product-1-20mg", strength: 20 }, 1, ACTOR);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(repo.items.get("SLUG#product-1-20mg|GUARD")).toMatchObject({
      entity: "slug_guard",
      product_id: "1",
    });
    expect(repo.items.get("SLUG#product-1-10mg|GUARD")).toMatchObject({
      entity: "slug_redirect",
      product_id: "1",
    });
    expect(repo.items.get("PRODUCT#1|META")).toMatchObject({
      slug: "product-1-20mg",
      GSI2PK: "SLUG#product-1-20mg",
      previous_slugs: ["product-1-10mg"],
    });
  });

  it("never lets a retired slug be taken by a different product", async () => {
    await service.update("1", { slug: "product-1-20mg" }, 1, ACTOR);
    repo.seed(source("3", { slug: "product-3-10mg" }));

    const result = await service.update("3", { slug: "product-1-10mg" }, 1, ACTOR);

    expect(result).toMatchObject({ success: false, code: "SLUG_TAKEN" });
    expect(repo.items.get("SLUG#product-1-10mg|GUARD")).toMatchObject({ product_id: "1" });
  });

  it("lets a product take its own retired slug back", async () => {
    await service.update("1", { slug: "product-1-20mg" }, 1, ACTOR);

    const result = await service.update("1", { slug: "product-1-10mg" }, 2, ACTOR);

    expect(result.success).toBe(true);
    expect(repo.items.get("SLUG#product-1-10mg|GUARD")).toMatchObject({ entity: "slug_guard" });
    expect(repo.items.get("PRODUCT#1|META")?.previous_slugs).toEqual(["product-1-20mg"]);
  });
});

describe("archive and restore (D37: nothing is deleted)", () => {
  beforeEach(() => repo.seed(source("1")));

  it("archives by status, keeps the item and logs it", async () => {
    const result = await service.archive("1", 1, ACTOR);

    expect(result.success).toBe(true);
    expect(repo.items.get("PRODUCT#1|META")).toMatchObject({ status: "archived", version: 2 });
    expect(repo.items.get("PRODUCT#1|META")?.deleted_at).toBeUndefined();
    expect(repo.auditItems()[0]).toMatchObject({
      action: "product_archived",
      changes: { status: { from: "active", to: "archived" } },
    });
  });

  it("restores to active and logs it", async () => {
    await service.archive("1", 1, ACTOR);

    const result = await service.restore("1", 2, ACTOR);

    expect(result.success).toBe(true);
    expect(repo.items.get("PRODUCT#1|META")?.status).toBe("active");
    expect(repo.auditItems().map((item) => item.action)).toEqual(
      expect.arrayContaining(["product_archived", "product_restored"]),
    );
  });
});

describe("reorder", () => {
  beforeEach(() => {
    repo.seed(source("1", { sort_order: 10 }));
    repo.seed(source("2", { sort_order: 20 }));
    repo.seed(source("3", { sort_order: 30 }));
  });

  it("swaps a product with its neighbour and writes only what moved", async () => {
    const result = await service.reorder("3", "up", ACTOR);

    expect(result).toMatchObject({ success: true, data: { moved: true } });
    expect(repo.items.get("PRODUCT#3|META")?.sort_order).toBe(20);
    expect(repo.items.get("PRODUCT#2|META")?.sort_order).toBe(30);
    expect(repo.items.get("PRODUCT#1|META")?.sort_order).toBe(10);
    // The catalog index key follows the order.
    expect(String(repo.items.get("PRODUCT#3|META")?.GSI1SK).startsWith("000020#")).toBe(true);
    expect(repo.auditItems()[0]).toMatchObject({ action: "product_reordered", target: "3" });
  });

  it("does nothing at either end of the list", async () => {
    expect(await service.reorder("1", "up", ACTOR)).toMatchObject({ data: { moved: false } });
    expect(await service.reorder("3", "down", ACTOR)).toMatchObject({ data: { moved: false } });
    expect(repo.commits).toHaveLength(0);
  });

  it("repairs tied orders instead of swapping equal numbers", async () => {
    repo.items.clear();
    repo.seed(source("1", { sort_order: 10 }));
    repo.seed(source("2", { sort_order: 10 }));

    await service.reorder("2", "up", ACTOR);

    const first = repo.items.get("PRODUCT#2|META")?.sort_order as number;
    const second = repo.items.get("PRODUCT#1|META")?.sort_order as number;
    expect(first).toBeLessThan(second);
  });

  it("refuses when a product changed during the move", async () => {
    repo.failNextWith = new ProductWriteConflict("version");
    expect(await service.reorder("3", "up", ACTOR)).toMatchObject({
      success: false,
      code: "VERSION_CONFLICT",
    });
  });
});

describe("diffProduct", () => {
  it("lists only the fields that differ", () => {
    expect(diffProduct(VALID, { ...VALID, featured: true, price: 43 })).toEqual({
      featured: { from: false, to: true },
      priceCents: { from: 4250, to: 4300 },
    });
  });
});

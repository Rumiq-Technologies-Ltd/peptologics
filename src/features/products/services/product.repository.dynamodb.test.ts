import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDynamoProductRepository } from "@/features/products/services/product.repository.dynamodb";
import { DatabaseError } from "@/lib/errors";

vi.mock("@/lib/dynamodb/client.server", async () => {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient: Doc } = await import("@aws-sdk/lib-dynamodb");
  const client = Doc.from(new DynamoDBClient({ region: "us-east-1" }));
  return { getDocumentClient: () => client, getTableName: () => "test-table" };
});

let dynamo: ReturnType<typeof mockClient>;

beforeEach(() => {
  dynamo = mockClient(DynamoDBDocumentClient);
});

afterEach(() => {
  dynamo.restore();
});

function item(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    slug: `slug-${id}`,
    name: `Product ${id}`,
    category: "peptide",
    strength_mg: 10,
    strength_unit: "mg",
    price_cents: 5000,
    cost_per_mg: 5,
    is_blend: false,
    featured: false,
    sort_order: Number(id),
    status: "active",
    updated_at: "2026-11-01T00:00:00Z",
    ...overrides,
  };
}

describe("createDynamoProductRepository", () => {
  it("reads the whole catalog from GSI1, following pagination", async () => {
    dynamo
      .on(QueryCommand)
      .resolvesOnce({ Items: [item("2")], LastEvaluatedKey: { PK: "x", SK: "y" } })
      .resolves({ Items: [item("1")] });

    const products = await createDynamoProductRepository().findActive();

    expect(products.map((product) => product.id)).toEqual(["1", "2"]);
    const input = dynamo.commandCalls(QueryCommand)[0]?.args[0].input;
    expect(input?.IndexName).toBe("GSI1");
    expect(input?.ExpressionAttributeValues).toEqual({ ":pk": "PRODUCTS" });
  });

  it("hides archived and soft-deleted products, filters and sorts on the server", async () => {
    dynamo.on(QueryCommand).resolves({
      Items: [
        item("1", { price_cents: 9000 }),
        item("2", { price_cents: 1000 }),
        item("3", { status: "archived" }),
        item("4", { deleted_at: "2026-01-01T00:00:00Z" }),
        item("5", { category: "supply", name: "Water" }),
      ],
    });
    const repository = createDynamoProductRepository();

    const cheapestFirst = await repository.findActive({ sort: "price-asc" });
    expect(cheapestFirst.map((product) => product.id)).toEqual(["2", "5", "1"]);
    expect((await repository.findActive({ category: "supply" })).map((p) => p.id)).toEqual(["5"]);
    expect((await repository.findActive({ search: "water" })).map((p) => p.id)).toEqual(["5"]);
  });

  it("returns the featured products in order, up to the limit", async () => {
    dynamo.on(QueryCommand).resolves({
      Items: [item("1", { featured: true }), item("2"), item("3", { featured: true })],
    });

    const featured = await createDynamoProductRepository().findFeatured(1);
    expect(featured.map((product) => product.id)).toEqual(["1"]);
  });

  it("finds a product by slug through GSI2", async () => {
    dynamo.on(QueryCommand).resolves({ Items: [item("1")] });

    const product = await createDynamoProductRepository().findBySlug("slug-1");

    expect(product?.id).toBe("1");
    const input = dynamo.commandCalls(QueryCommand)[0]?.args[0].input;
    expect(input?.IndexName).toBe("GSI2");
    expect(input?.ExpressionAttributeValues).toEqual({ ":pk": "SLUG#slug-1" });
  });

  it("returns null, not an error, for a slug that does not exist", async () => {
    dynamo.on(QueryCommand).resolves({ Items: [] });
    await expect(createDynamoProductRepository().findBySlug("nope")).resolves.toBeNull();
  });

  it("returns null for a slug whose product is not public", async () => {
    dynamo.on(QueryCommand).resolves({ Items: [item("1", { status: "archived" })] });
    await expect(createDynamoProductRepository().findBySlug("slug-1")).resolves.toBeNull();
  });

  it("finds products by id and returns nothing for an empty list without querying", async () => {
    dynamo.on(QueryCommand).resolves({ Items: [item("1"), item("2"), item("3")] });
    const repository = createDynamoProductRepository();

    expect((await repository.findByIds(["1", "3"])).map((product) => product.id)).toEqual([
      "1",
      "3",
    ]);

    dynamo.resetHistory();
    await expect(repository.findByIds([])).resolves.toEqual([]);
    expect(dynamo.calls()).toHaveLength(0);
  });

  it("lists active slugs with their last update", async () => {
    dynamo.on(QueryCommand).resolves({ Items: [item("1"), item("2", { status: "archived" })] });

    await expect(createDynamoProductRepository().listActiveSlugs()).resolves.toEqual([
      { slug: "slug-1", updatedAt: "2026-11-01T00:00:00Z" },
    ]);
  });

  it("wraps SDK failures in a DatabaseError", async () => {
    dynamo.on(QueryCommand).rejects(new Error("AccessDeniedException"));
    await expect(createDynamoProductRepository().findActive()).rejects.toBeInstanceOf(
      DatabaseError,
    );
  });
});

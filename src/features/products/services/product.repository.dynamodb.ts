import "server-only";

import { QueryCommand } from "@aws-sdk/lib-dynamodb";

import { toProduct, toProducts } from "@/features/products/mappers/product.mappers";
import {
  isPublicProduct,
  selectPublicProducts,
  type ProductRecord,
} from "@/features/products/services/product.query";
import type { ProductRepository } from "@/features/products/services/product.repository";
import type { Product } from "@/features/products/types/product";
import { getDocumentClient, getTableName } from "@/lib/dynamodb/client.server";
import { CATALOG_PARTITION, INDEX } from "@/lib/dynamodb/entities";
import { toDatabaseError } from "@/lib/dynamodb/errors";

/**
 * Product reads on DynamoDB (ADR-035, ADR-036). Fetch only: no business decisions.
 *
 * The whole catalog (about a dozen items) is one Query on GSI1; filtering by category,
 * name search and sorting happen in `product.query.ts`. `findBySlug` uses GSI2.
 */

/**
 * Explicit attribute list: no `SELECT *` equivalent. Names go through placeholders
 * because `status` and `name` are DynamoDB reserved words.
 */
const PRODUCT_ATTRIBUTES = [
  "id",
  "slug",
  "name",
  "description",
  "category",
  "strength_mg",
  "strength_unit",
  "price_cents",
  "cost_per_mg",
  "is_blend",
  "featured",
  "sort_order",
  "image_url",
  "coa_url",
  "status",
  "deleted_at",
  "updated_at",
] as const;

const projection = {
  ProjectionExpression: PRODUCT_ATTRIBUTES.map((_, index) => `#a${index}`).join(", "),
  ExpressionAttributeNames: Object.fromEntries(
    PRODUCT_ATTRIBUTES.map((attribute, index) => [`#a${index}`, attribute]),
  ),
};

/**
 * An absent attribute is how DynamoDB stores a null column, but the mapper (written for
 * PostgREST rows) expects `null`. Restoring it here keeps the mapper unchanged.
 */
function toRecord(item: Record<string, unknown>): ProductRecord {
  const record = item as unknown as ProductRecord;

  return {
    ...record,
    description: record.description ?? null,
    image_url: record.image_url ?? null,
    coa_url: record.coa_url ?? null,
  };
}

/** Every product in the catalog partition, following pagination to the end. */
async function loadCatalog(operation: string): Promise<ProductRecord[]> {
  const client = getDocumentClient();
  const records: ProductRecord[] = [];
  let startKey: Record<string, unknown> | undefined;

  try {
    do {
      const page = await client.send(
        new QueryCommand({
          TableName: getTableName(),
          IndexName: INDEX.primary,
          KeyConditionExpression: "GSI1PK = :pk",
          ExpressionAttributeValues: { ":pk": CATALOG_PARTITION },
          ExclusiveStartKey: startKey,
          ...projection,
        }),
      );

      records.push(...(page.Items ?? []).map(toRecord));
      startKey = page.LastEvaluatedKey;
    } while (startKey);
  } catch (error) {
    throw toDatabaseError(operation, error);
  }

  return records;
}

export function createDynamoProductRepository(): ProductRepository {
  return {
    async findActive(options = {}): Promise<Product[]> {
      const catalog = await loadCatalog("products.findActive");
      return toProducts(selectPublicProducts(catalog, options));
    },

    async findFeatured(limit): Promise<Product[]> {
      const catalog = await loadCatalog("products.findFeatured");
      const featured = selectPublicProducts(catalog).filter((record) => record.featured);
      return toProducts(featured.slice(0, limit));
    },

    async findBySlug(slug): Promise<Product | null> {
      try {
        const page = await getDocumentClient().send(
          new QueryCommand({
            TableName: getTableName(),
            IndexName: INDEX.slug,
            KeyConditionExpression: "GSI2PK = :pk",
            ExpressionAttributeValues: { ":pk": `SLUG#${slug}` },
            Limit: 1,
            ...projection,
          }),
        );

        const first = page.Items?.[0];
        const record = first ? toRecord(first) : undefined;

        // An unknown or non-public slug is an ordinary 404, not an error.
        return record && isPublicProduct(record) ? toProduct(record) : null;
      } catch (error) {
        throw toDatabaseError("products.findBySlug", error);
      }
    },

    async findByIds(ids): Promise<Product[]> {
      if (ids.length === 0) return [];

      // Read from the catalog Query rather than BatchGetItem: at this size it is one
      // request either way, and it needs no IAM action beyond Query.
      const wanted = new Set(ids);
      const catalog = await loadCatalog("products.findByIds");
      return toProducts(selectPublicProducts(catalog).filter((record) => wanted.has(record.id)));
    },

    async listActiveSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
      const catalog = await loadCatalog("products.listActiveSlugs");

      return selectPublicProducts(catalog).map((record) => ({
        slug: record.slug,
        updatedAt: record.updated_at ?? new Date(0).toISOString(),
      }));
    },
  };
}

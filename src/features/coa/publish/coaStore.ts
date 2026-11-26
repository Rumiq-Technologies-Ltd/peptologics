import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";

import type {
  PublishPlan,
  PublishProduct,
  StoredCoaVersion,
} from "@/features/coa/publish/coaPublishPlan";
import { CATALOG_PARTITION, INDEX, keys } from "@/lib/dynamodb/entities";

/**
 * The publish script's table access. Every function takes the client and table name, so the
 * same code is tested against a mock and run against `peptologics-dev`.
 *
 * Unlike the app's repositories, this is allowed to write, and it is only ever called from
 * `scripts/coa.ts`. The public site has no path to it.
 */

type WritePlan = Extract<PublishPlan, { kind: "write" }>;

interface StoredProduct {
  id?: string;
  slug?: string;
  name?: string;
  category?: string;
  strength_mg?: number;
  strength_unit?: string;
  deleted_at?: string;
}

function toPublishProduct(item: StoredProduct): PublishProduct | null {
  if (
    !item.id ||
    !item.slug ||
    !item.name ||
    !item.category ||
    typeof item.strength_mg !== "number" ||
    !item.strength_unit ||
    item.deleted_at
  ) {
    return null;
  }

  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    category: item.category,
    strengthMg: item.strength_mg,
    strengthUnit: item.strength_unit,
  };
}

/** The highest stored version of a report, read strongly consistent, or null if none. */
export async function fetchLatestVersion(
  client: DynamoDBDocumentClient,
  table: string,
  reportId: string,
): Promise<StoredCoaVersion | null> {
  const page = await client.send(
    new QueryCommand({
      TableName: table,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": keys.coaPartition(reportId) },
      ScanIndexForward: false,
      Limit: 1,
      ConsistentRead: true,
    }),
  );

  return (page.Items?.[0] as StoredCoaVersion | undefined) ?? null;
}

/** A product by id, or null if it is missing or soft-deleted. */
export async function fetchProduct(
  client: DynamoDBDocumentClient,
  table: string,
  productId: string,
): Promise<PublishProduct | null> {
  const result = await client.send(
    new GetCommand({ TableName: table, Key: keys.product(productId), ConsistentRead: true }),
  );

  return result.Item ? toPublishProduct(result.Item as StoredProduct) : null;
}

/** Every product, for staff who need an id to put in a manifest. */
export async function listProducts(
  client: DynamoDBDocumentClient,
  table: string,
): Promise<PublishProduct[]> {
  const products: PublishProduct[] = [];
  let startKey: Record<string, unknown> | undefined;

  do {
    const page = await client.send(
      new QueryCommand({
        TableName: table,
        IndexName: INDEX.primary,
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: { ":pk": CATALOG_PARTITION },
        ExclusiveStartKey: startKey,
      }),
    );

    for (const item of page.Items ?? []) {
      const product = toPublishProduct(item as StoredProduct);
      if (product) products.push(product);
    }

    startKey = page.LastEvaluatedKey;
  } while (startKey);

  return products;
}

/**
 * Writes a planned version in one transaction: the new version, and the removal of the
 * current-version marker from the one it replaces. Either both happen or neither does.
 *
 * The put refuses to overwrite an existing version, so two people publishing the same report
 * at once cannot both win; the second gets a conflict instead of silently replacing the first.
 */
export async function commitPlan(
  client: DynamoDBDocumentClient,
  table: string,
  plan: WritePlan,
): Promise<void> {
  await client.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: table,
            Item: plan.item,
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
          },
        },
        ...(plan.previousKey
          ? [
              {
                Update: {
                  TableName: table,
                  Key: plan.previousKey,
                  UpdateExpression: "REMOVE GSI1PK, GSI1SK",
                  ConditionExpression: "attribute_exists(PK)",
                },
              },
            ]
          : []),
      ],
    }),
  );
}

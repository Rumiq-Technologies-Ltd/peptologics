import "server-only";

import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";

import { getDocumentClient, getTableName } from "@/lib/dynamodb/client.server";
import { CATALOG_PARTITION, INDEX, keys, type Item } from "@/lib/dynamodb/entities";
import { toDatabaseError } from "@/lib/dynamodb/errors";

import {
  MAX_TRANSACTION_ITEMS,
  ProductWriteConflict,
  type ProductAdminRepository,
  type WriteStep,
} from "./productAdmin.repository";

/**
 * Product writes for the admin. Persistence only: the rules live in the service.
 *
 * Every change is one transaction holding the product, its slug guards and its audit item,
 * so a change can never exist without its log line, and a slug can never end up on two products.
 */

export function createDynamoProductAdminRepository(): ProductAdminRepository {
  return {
    async listItems(): Promise<Item[]> {
      const client = getDocumentClient();
      const items: Item[] = [];
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
            }),
          );

          items.push(...((page.Items ?? []) as Item[]));
          startKey = page.LastEvaluatedKey;
        } while (startKey);
      } catch (error) {
        throw toDatabaseError("productAdmin.listItems", error);
      }

      return items;
    },

    async getItem(productId): Promise<Item | null> {
      try {
        const result = await getDocumentClient().send(
          new GetCommand({ TableName: getTableName(), Key: keys.product(productId) }),
        );
        return (result.Item as Item | undefined) ?? null;
      } catch (error) {
        throw toDatabaseError("productAdmin.getItem", error);
      }
    },

    async commit(steps): Promise<void> {
      if (steps.length > MAX_TRANSACTION_ITEMS) {
        throw toDatabaseError("productAdmin.commit", new Error("Too many items in one change."));
      }

      const input: TransactWriteCommandInput = {
        TransactItems: steps.map((step) => ({
          Put: {
            TableName: getTableName(),
            Item: step.item,
            ConditionExpression: step.condition?.expression,
            ExpressionAttributeNames: step.condition?.names,
            ExpressionAttributeValues: step.condition?.values,
          },
        })),
      };

      try {
        await getDocumentClient().send(new TransactWriteCommand(input));
      } catch (error) {
        const conflict = conflictFrom(error, steps);
        if (conflict) throw conflict;
        throw toDatabaseError("productAdmin.commit", error);
      }
    },
  };
}

/** Maps a cancelled transaction to the first step whose condition failed. */
function conflictFrom(error: unknown, steps: readonly WriteStep[]): ProductWriteConflict | null {
  if (!(error instanceof Error) || error.name !== "TransactionCanceledException") return null;

  const reasons = (error as { CancellationReasons?: { Code?: string }[] }).CancellationReasons;
  const index = reasons?.findIndex((reason) => reason.Code === "ConditionalCheckFailed") ?? -1;
  if (index < 0) return null;

  return new ProductWriteConflict(steps[index]?.onConflict ?? "exists");
}

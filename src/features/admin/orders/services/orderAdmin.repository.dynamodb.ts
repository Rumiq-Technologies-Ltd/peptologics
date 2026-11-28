import "server-only";

import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  type QueryCommandInput,
  type TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";

import { getDocumentClient, getTableName } from "@/lib/dynamodb/client.server";
import {
  INDEX,
  OPEN_NOTIFICATIONS_PARTITION,
  keys,
  orderNumberPartition,
  type Item,
} from "@/lib/dynamodb/entities";
import { toDatabaseError } from "@/lib/dynamodb/errors";

import {
  MAX_TRANSACTION_ITEMS,
  OrderWriteConflict,
  type OrderAdminRepository,
  type OrderWriteStep,
} from "./orderAdmin.repository";

/**
 * Order reads and writes for the admin. Persistence only: the rules live in the service.
 * No call here scans the table: every read is a Query on a key or an index.
 */

/** Follows `LastEvaluatedKey` until the Query is exhausted. */
async function queryAll(input: QueryCommandInput): Promise<Item[]> {
  const client = getDocumentClient();
  const items: Item[] = [];
  let startKey: Record<string, unknown> | undefined;

  do {
    const page = await client.send(new QueryCommand({ ...input, ExclusiveStartKey: startKey }));
    items.push(...((page.Items ?? []) as Item[]));
    startKey = page.LastEvaluatedKey;
  } while (startKey);

  return items;
}

export function createDynamoOrderAdminRepository(): OrderAdminRepository {
  return {
    async listMonth(month): Promise<Item[]> {
      try {
        return await queryAll({
          TableName: getTableName(),
          IndexName: INDEX.primary,
          KeyConditionExpression: "GSI1PK = :pk",
          ExpressionAttributeValues: { ":pk": `ORDERS#${month}` },
          ScanIndexForward: false,
        });
      } catch (error) {
        throw toDatabaseError("orderAdmin.listMonth", error);
      }
    },

    async listOpenNotifications(): Promise<Item[]> {
      try {
        return await queryAll({
          TableName: getTableName(),
          IndexName: INDEX.openNotifications,
          KeyConditionExpression: "GSI3PK = :pk",
          ExpressionAttributeValues: { ":pk": OPEN_NOTIFICATIONS_PARTITION },
        });
      } catch (error) {
        throw toDatabaseError("orderAdmin.listOpenNotifications", error);
      }
    },

    async findOrderByNumber(orderNumber): Promise<Item | null> {
      try {
        const items = await queryAll({
          TableName: getTableName(),
          IndexName: INDEX.slug,
          KeyConditionExpression: "GSI2PK = :pk",
          ExpressionAttributeValues: { ":pk": orderNumberPartition(orderNumber) },
        });
        return items[0] ?? null;
      } catch (error) {
        throw toDatabaseError("orderAdmin.findOrderByNumber", error);
      }
    },

    async getOrderItem(orderId): Promise<Item | null> {
      try {
        const result = await getDocumentClient().send(
          new GetCommand({ TableName: getTableName(), Key: keys.order(orderId) }),
        );
        return (result.Item as Item | undefined) ?? null;
      } catch (error) {
        throw toDatabaseError("orderAdmin.getOrderItem", error);
      }
    },

    async getOrderPartition(orderId): Promise<Item[]> {
      try {
        return await queryAll({
          TableName: getTableName(),
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: { ":pk": keys.order(orderId).PK },
        });
      } catch (error) {
        throw toDatabaseError("orderAdmin.getOrderPartition", error);
      }
    },

    async countNewInMonth(month): Promise<number> {
      const client = getDocumentClient();
      let total = 0;
      let startKey: Record<string, unknown> | undefined;

      try {
        do {
          const page = await client.send(
            new QueryCommand({
              TableName: getTableName(),
              IndexName: INDEX.primary,
              KeyConditionExpression: "GSI1PK = :pk",
              FilterExpression: "#s = :new AND attribute_not_exists(deleted_at)",
              ExpressionAttributeNames: { "#s": "status" },
              ExpressionAttributeValues: { ":pk": `ORDERS#${month}`, ":new": "new" },
              Select: "COUNT",
              ExclusiveStartKey: startKey,
            }),
          );
          total += page.Count ?? 0;
          startKey = page.LastEvaluatedKey;
        } while (startKey);
      } catch (error) {
        throw toDatabaseError("orderAdmin.countNewInMonth", error);
      }

      return total;
    },

    async commit(steps): Promise<void> {
      if (steps.length > MAX_TRANSACTION_ITEMS) {
        throw toDatabaseError("orderAdmin.commit", new Error("Too many items in one change."));
      }

      const input: TransactWriteCommandInput = {
        TransactItems: steps.map((step) => toTransactItem(step)),
      };

      try {
        await getDocumentClient().send(new TransactWriteCommand(input));
      } catch (error) {
        const conflict = conflictFrom(error, steps);
        if (conflict) throw conflict;
        throw toDatabaseError("orderAdmin.commit", error);
      }
    },
  };
}

function toTransactItem(
  step: OrderWriteStep,
): NonNullable<TransactWriteCommandInput["TransactItems"]>[number] {
  const TableName = getTableName();
  const condition = step.condition && {
    ConditionExpression: step.condition.expression,
    ExpressionAttributeNames: step.condition.names,
    ExpressionAttributeValues: step.condition.values,
  };

  if (step.kind === "put") return { Put: { TableName, Item: step.item, ...condition } };

  if (step.kind === "check") {
    return {
      ConditionCheck: {
        TableName,
        Key: step.key,
        ConditionExpression: step.condition.expression,
        ExpressionAttributeNames: step.condition.names,
        ExpressionAttributeValues: step.condition.values,
      },
    };
  }

  return {
    Update: {
      TableName,
      Key: step.key,
      UpdateExpression: step.update,
      ConditionExpression: step.condition?.expression,
      // The update's own names and values sit beside the condition's.
      ExpressionAttributeNames: mergeOrUndefined(step.names, step.condition?.names),
      ExpressionAttributeValues: mergeOrUndefined(step.values, step.condition?.values),
    },
  };
}

function mergeOrUndefined<T>(
  a?: Record<string, T>,
  b?: Record<string, T>,
): Record<string, T> | undefined {
  return a || b ? { ...a, ...b } : undefined;
}

/** Maps a cancelled transaction to the first step whose condition failed. */
function conflictFrom(error: unknown, steps: readonly OrderWriteStep[]): OrderWriteConflict | null {
  if (!(error instanceof Error) || error.name !== "TransactionCanceledException") return null;

  const reasons = (error as { CancellationReasons?: { Code?: string }[] }).CancellationReasons;
  const index = reasons?.findIndex((reason) => reason.Code === "ConditionalCheckFailed") ?? -1;
  if (index < 0) return null;

  return new OrderWriteConflict(steps[index]?.onConflict ?? "version");
}

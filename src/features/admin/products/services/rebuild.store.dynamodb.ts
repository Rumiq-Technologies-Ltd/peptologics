import "server-only";

import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { getDocumentClient, getTableName } from "@/lib/dynamodb/client.server";
import { keys } from "@/lib/dynamodb/entities";
import { toDatabaseError } from "@/lib/dynamodb/errors";

import type { RebuildState, RebuildStore } from "./rebuild.service";

/** One item holds the build window and whether a build is owed. Timestamps are ISO, so they sort. */
export function createDynamoRebuildStore(): RebuildStore {
  const run = (operation: string, command: UpdateCommand) =>
    getDocumentClient()
      .send(command)
      .catch((error: unknown) => {
        throw toDatabaseError(operation, error);
      });

  return {
    async getState(): Promise<RebuildState> {
      try {
        const result = await getDocumentClient().send(
          new GetCommand({ TableName: getTableName(), Key: keys.rebuildState }),
        );
        return {
          lastTriggeredAt:
            typeof result.Item?.last_triggered_at === "string"
              ? result.Item.last_triggered_at
              : null,
          pending: result.Item?.pending === true,
        };
      } catch (error) {
        throw toDatabaseError("rebuild.getState", error);
      }
    },

    async claim(nowIso, cutoffIso): Promise<boolean> {
      try {
        await getDocumentClient().send(
          new UpdateCommand({
            TableName: getTableName(),
            Key: keys.rebuildState,
            UpdateExpression: "SET last_triggered_at = :now, pending = :no, entity = :entity",
            ConditionExpression:
              "attribute_not_exists(last_triggered_at) OR last_triggered_at < :cutoff",
            ExpressionAttributeValues: {
              ":now": nowIso,
              ":cutoff": cutoffIso,
              ":no": false,
              ":entity": "rebuild_state",
            },
          }),
        );
        return true;
      } catch (error) {
        if (error instanceof Error && error.name === "ConditionalCheckFailedException")
          return false;
        throw toDatabaseError("rebuild.claim", error);
      }
    },

    async markPending(): Promise<void> {
      await run(
        "rebuild.markPending",
        new UpdateCommand({
          TableName: getTableName(),
          Key: keys.rebuildState,
          UpdateExpression: "SET pending = :yes, entity = :entity",
          ExpressionAttributeValues: { ":yes": true, ":entity": "rebuild_state" },
        }),
      );
    },

    async release(): Promise<void> {
      await run(
        "rebuild.release",
        new UpdateCommand({
          TableName: getTableName(),
          Key: keys.rebuildState,
          UpdateExpression: "SET last_triggered_at = :epoch",
          ExpressionAttributeValues: { ":epoch": new Date(0).toISOString() },
        }),
      );
    },
  };
}

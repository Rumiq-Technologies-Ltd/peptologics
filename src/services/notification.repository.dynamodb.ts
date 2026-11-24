import "server-only";

import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";

import type { NotificationRepository } from "@/services/notification.repository";
import { getDocumentClient, getTableName } from "@/lib/dynamodb/client.server";
import { isOpenNotificationStatus, keys } from "@/lib/dynamodb/entities";
import { toDatabaseError } from "@/lib/dynamodb/errors";
import { DatabaseError } from "@/lib/errors";

/**
 * Notification outcomes on DynamoDB (ADR-035).
 *
 * `create()` writes one `pending` item per channel inside the order's own transaction, so
 * this only ever *updates* an existing item. A `pending` or `failed` item carries the
 * sparse GSI3 keys and is on the dead-letter list; recording `sent` or `skipped` removes
 * those keys, which takes the item off the list.
 */

/** Same limit the Postgres CHECK enforced: provider errors can be long and echo content. */
const MAX_ERROR_LENGTH = 1000;

export function createDynamoNotificationRepository(): NotificationRepository {
  return {
    async recordOutcome(orderId, outcome): Promise<void> {
      const now = new Date().toISOString();

      const sets = ["#status = :status", "attempts = :attempts", "updated_at = :now"];
      const removes: string[] = [];
      const values: Record<string, unknown> = {
        ":status": outcome.status,
        ":attempts": outcome.attempts,
        ":now": now,
      };

      const optional: [string, string, string | undefined][] = [
        ["provider_message_id", ":messageId", outcome.providerMessageId],
        ["error_message", ":error", outcome.errorMessage?.slice(0, MAX_ERROR_LENGTH)],
        ["sent_at", ":sentAt", outcome.status === "sent" ? now : undefined],
      ];

      for (const [attribute, placeholder, value] of optional) {
        if (value === undefined) {
          removes.push(attribute);
        } else {
          sets.push(`${attribute} = ${placeholder}`);
          values[placeholder] = value;
        }
      }

      if (!isOpenNotificationStatus(outcome.status)) removes.push("GSI3PK", "GSI3SK");

      const expression = `SET ${sets.join(", ")}${removes.length > 0 ? ` REMOVE ${removes.join(", ")}` : ""}`;

      try {
        await getDocumentClient().send(
          new UpdateCommand({
            TableName: getTableName(),
            Key: keys.notification(orderId, outcome.channel),
            // Never create a notification from here: a missing item is a bug, not an insert.
            ConditionExpression: "attribute_exists(PK)",
            UpdateExpression: expression,
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: values,
          }),
        );
      } catch (error) {
        if (error instanceof ConditionalCheckFailedException) {
          throw new DatabaseError(
            "notificationLog.recordOutcome",
            "no notification item exists for this order and channel",
            { cause: error },
          );
        }

        throw toDatabaseError("notificationLog.recordOutcome", error);
      }
    },
  };
}

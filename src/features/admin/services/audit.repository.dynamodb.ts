import "server-only";

import { PutCommand } from "@aws-sdk/lib-dynamodb";

import { getDocumentClient, getTableName } from "@/lib/dynamodb/client.server";
import { buildAuditItem, type AuditSource } from "@/lib/dynamodb/entities";
import { toDatabaseError } from "@/lib/dynamodb/errors";

/** Appends one audit item. Items are never updated or deleted by the application. */
export async function putAuditEntry(entry: AuditSource): Promise<void> {
  try {
    await getDocumentClient().send(
      new PutCommand({
        TableName: getTableName(),
        Item: buildAuditItem(entry),
        // An id collision would silently overwrite history; refuse instead.
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );
  } catch (error) {
    throw toDatabaseError("write audit entry", error);
  }
}

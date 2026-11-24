import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { awsClientDefaults } from "@/lib/aws/config";
import { env } from "@/lib/env";

/**
 * The DynamoDB document client (ADR-035). Server-only.
 *
 * Credentials are never configured here: on Amplify they come from the app's compute IAM
 * role, locally from `AWS_PROFILE` (see `src/lib/aws/config.ts`). The table is chosen by
 * `DYNAMODB_TABLE_NAME`, which is how dev, staging and prod stay apart.
 */

let documentClient: DynamoDBDocumentClient | undefined;

/** Built once per server instance; carries no per-request state. */
export function getDocumentClient(): DynamoDBDocumentClient {
  documentClient ??= DynamoDBDocumentClient.from(new DynamoDBClient({ ...awsClientDefaults }), {
    // A field the application leaves undefined means "absent", not a write error.
    marshallOptions: { removeUndefinedValues: true },
  });

  return documentClient;
}

export function getTableName(): string {
  const tableName = env.DYNAMODB_TABLE_NAME;

  if (!tableName) {
    // Unreachable when INQUIRY_DATA_STORE=dynamodb (env.ts refuses to boot), but this
    // keeps the type honest and the message specific if it is ever reached.
    throw new Error("DYNAMODB_TABLE_NAME is not set, so the DynamoDB data store is unavailable.");
  }

  return tableName;
}

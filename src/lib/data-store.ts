import "server-only";

import { env } from "@/lib/env";
import { isWriteClientAvailable } from "@/lib/supabase/client.server";

/**
 * Whether the inquiry write path has what it needs to run, for the health endpoint.
 *
 * Supabase needs its service-role key. DynamoDB needs nothing beyond the table name,
 * which `env.ts` already refuses to boot without; the credentials come from the IAM role
 * and are exercised by the health route's real catalog read.
 */
export function isInquiryWriteStoreAvailable(): boolean {
  return env.INQUIRY_DATA_STORE === "dynamodb"
    ? Boolean(env.DYNAMODB_TABLE_NAME)
    : isWriteClientAvailable();
}

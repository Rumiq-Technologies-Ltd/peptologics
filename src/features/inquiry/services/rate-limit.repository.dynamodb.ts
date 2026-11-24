import "server-only";

import { UpdateCommand } from "@aws-sdk/lib-dynamodb";

import type {
  RateLimitRepository,
  RateLimitVerdict,
} from "@/features/inquiry/services/rate-limit.repository";
import { getDocumentClient, getTableName } from "@/lib/dynamodb/client.server";
import { keys } from "@/lib/dynamodb/entities";
import { toDatabaseError } from "@/lib/dynamodb/errors";
import { DatabaseError } from "@/lib/errors";

/**
 * Rate limiting on DynamoDB (ADR-035). Replaces `check_rate_limit`.
 *
 * One item per bucket per fixed window, and a single atomic `ADD hits 1` that returns the
 * new count: the increment and the read are one operation, so two concurrent requests can
 * never both see "4" and both pass.
 *
 * The window start is part of the key, so a new window is a new item and correctness never
 * depends on old items being deleted. Deletion is the table's TTL on `expires_at`, which
 * DynamoDB applies lazily (up to about 48 hours late); the extra hour of grace is only so
 * an item is never removed while its window is still open.
 */

const EXPIRY_GRACE_SECONDS = 3600;

export function createDynamoRateLimitRepository(): RateLimitRepository {
  return {
    async hit(bucketKey, maxHits, windowSeconds): Promise<RateLimitVerdict> {
      if (maxHits < 1 || windowSeconds < 1) {
        throw new DatabaseError("rateLimit.hit", "maxHits and windowSeconds must be positive");
      }

      const nowSeconds = Date.now() / 1000;
      const windowStart = Math.floor(nowSeconds / windowSeconds) * windowSeconds;
      const windowEnd = windowStart + windowSeconds;

      try {
        const { Attributes } = await getDocumentClient().send(
          new UpdateCommand({
            TableName: getTableName(),
            Key: keys.rateLimit(bucketKey, windowStart),
            UpdateExpression: "SET expires_at = :expires, window_started_at = :start ADD hits :one",
            ExpressionAttributeValues: {
              ":expires": windowEnd + EXPIRY_GRACE_SECONDS,
              ":start": windowStart,
              ":one": 1,
            },
            ReturnValues: "UPDATED_NEW",
          }),
        );

        const hits = Attributes?.hits;

        if (typeof hits !== "number") {
          throw new DatabaseError("rateLimit.hit", "rate-limit counter returned no count");
        }

        return {
          allowed: hits <= maxHits,
          hitCount: hits,
          limit: maxHits,
          // Never zero: `Retry-After: 0` invites an immediate retry.
          retryAfterSeconds: Math.max(1, Math.ceil(windowEnd - nowSeconds)),
        };
      } catch (error) {
        throw toDatabaseError("rateLimit.hit", error);
      }
    },
  };
}

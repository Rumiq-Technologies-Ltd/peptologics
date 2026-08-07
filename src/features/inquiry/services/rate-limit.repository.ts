import "server-only";

import { DatabaseError } from "@/lib/errors";
import { getWriteClient } from "@/lib/supabase/client.server";

/**
 * Database access for rate limiting.
 *
 * The counter lives in Postgres rather than Redis (ADR-011): the project already
 * has a transactional database, and one atomic `INSERT ... ON CONFLICT DO UPDATE
 * ... RETURNING` is a correct fixed-window limiter without adding an entire piece
 * of infrastructure to operate.
 *
 * Reading the counter here and deciding in TypeScript would be a race — two
 * concurrent requests could both read 5 and both allow themselves — so the
 * increment and the test happen inside `check_rate_limit`.
 */

export interface RateLimitVerdict {
  allowed: boolean;
  hitCount: number;
  limit: number;
  /** Seconds until the current window closes. Never zero. */
  retryAfterSeconds: number;
}

export interface RateLimitRepository {
  /** Increments the bucket's counter and reports whether the caller is within the limit. */
  hit(bucketKey: string, maxHits: number, windowSeconds: number): Promise<RateLimitVerdict>;
}

function toVerdict(value: unknown): RateLimitVerdict {
  if (typeof value !== "object" || value === null) {
    throw new DatabaseError("rateLimit.hit", "check_rate_limit returned a non-object");
  }

  const record = value as Record<string, unknown>;

  if (typeof record.allowed !== "boolean") {
    throw new DatabaseError("rateLimit.hit", "check_rate_limit returned no verdict");
  }

  return {
    allowed: record.allowed,
    hitCount: typeof record.hit_count === "number" ? record.hit_count : 0,
    limit: typeof record.limit === "number" ? record.limit : maxHitsFallback,
    // Falls back to one second rather than zero: a `Retry-After: 0` invites an
    // immediate retry, which is the opposite of what a limiter is for.
    retryAfterSeconds:
      typeof record.retry_after_seconds === "number" ? record.retry_after_seconds : 1,
  };
}

/** Only reached if the RPC's return shape changes; the real value always arrives. */
const maxHitsFallback = 0;

export function createRateLimitRepository(): RateLimitRepository {
  return {
    async hit(bucketKey, maxHits, windowSeconds): Promise<RateLimitVerdict> {
      const client = getWriteClient();

      const { data, error } = await client.rpc("check_rate_limit", {
        p_bucket_key: bucketKey,
        p_max_hits: maxHits,
        p_window_seconds: windowSeconds,
      });

      if (error) {
        throw new DatabaseError("rateLimit.hit", error.message, { cause: error });
      }

      return toVerdict(data);
    },
  };
}

import "server-only";

import { INQUIRY_RATE_LIMIT_MAX, INQUIRY_RATE_LIMIT_WINDOW_SECONDS } from "@/constants/business";
import type {
  RateLimitRepository,
  RateLimitVerdict,
} from "@/features/inquiry/services/rate-limit.repository";
import { logger } from "@/lib/logger";

/**
 * Rate limiting policy for the public inquiry endpoint.
 *
 * The repository does the atomic counting; this decides the numbers and what to do
 * when the counter itself is unavailable.
 *
 * Five submissions per fifteen minutes per hashed IP: generous enough that someone
 * correcting a typo and resubmitting three times is never blocked, tight enough that
 * a script cannot fill the inbox.
 */

export interface RateLimitService {
  /** Records a hit against the inquiry bucket and reports the verdict. */
  checkInquiry(bucketKey: string): Promise<RateLimitVerdict>;
}

export interface RateLimitServiceDeps {
  repository: RateLimitRepository;
}

export function createRateLimitService({ repository }: RateLimitServiceDeps): RateLimitService {
  return {
    async checkInquiry(bucketKey): Promise<RateLimitVerdict> {
      try {
        return await repository.hit(
          `inquiry:${bucketKey}`,
          INQUIRY_RATE_LIMIT_MAX,
          INQUIRY_RATE_LIMIT_WINDOW_SECONDS,
        );
      } catch (error) {
        /*
         * Fails open, deliberately.
         *
         * The counter lives in the same database as the order. If it is unreachable,
         * the insert that follows cannot succeed either — so blocking here would
         * turn one broken dependency into a second, less honest failure mode
         * (a 429 that blames the visitor for an outage). The submission proceeds and
         * fails, if it fails, on its own terms.
         */
        logger.error("rate_limit_check_failed_open", { error });

        return {
          allowed: true,
          hitCount: 0,
          limit: INQUIRY_RATE_LIMIT_MAX,
          retryAfterSeconds: 1,
        };
      }
    },
  };
}

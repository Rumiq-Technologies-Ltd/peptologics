import "server-only";

import {
  CONTACT_RATE_LIMIT_MAX,
  CONTACT_RATE_LIMIT_WINDOW_SECONDS,
  INQUIRY_RATE_LIMIT_MAX,
  INQUIRY_RATE_LIMIT_WINDOW_SECONDS,
} from "@/constants/business";
import type {
  RateLimitRepository,
  RateLimitVerdict,
} from "@/features/inquiry/services/rate-limit.repository";
import { logger } from "@/lib/logger";

/**
 * Rate limiting policy for the public form endpoints.
 *
 * The repository does the atomic counting; this decides the numbers and what to do
 * when the counter itself is unavailable.
 *
 * Five submissions per fifteen minutes per hashed IP: generous enough that someone
 * correcting a typo and resubmitting three times is never blocked, tight enough that
 * a script cannot fill the inbox. The inquiry and contact forms each count in their own
 * bucket, so using one never uses up the other's allowance.
 */

export interface RateLimitService {
  /** Records a hit against the inquiry bucket and reports the verdict. */
  checkInquiry(bucketKey: string): Promise<RateLimitVerdict>;
  /** Records a hit against the contact-form bucket and reports the verdict. */
  checkContact(bucketKey: string): Promise<RateLimitVerdict>;
}

export interface RateLimitServiceDeps {
  repository: RateLimitRepository;
}

interface BucketPolicy {
  prefix: string;
  max: number;
  windowSeconds: number;
}

const INQUIRY_BUCKET: BucketPolicy = {
  prefix: "inquiry",
  max: INQUIRY_RATE_LIMIT_MAX,
  windowSeconds: INQUIRY_RATE_LIMIT_WINDOW_SECONDS,
};

const CONTACT_BUCKET: BucketPolicy = {
  prefix: "contact",
  max: CONTACT_RATE_LIMIT_MAX,
  windowSeconds: CONTACT_RATE_LIMIT_WINDOW_SECONDS,
};

export function createRateLimitService({ repository }: RateLimitServiceDeps): RateLimitService {
  async function check(policy: BucketPolicy, bucketKey: string): Promise<RateLimitVerdict> {
    try {
      return await repository.hit(
        `${policy.prefix}:${bucketKey}`,
        policy.max,
        policy.windowSeconds,
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
      logger.error("rate_limit_check_failed_open", { error, bucket: policy.prefix });

      return {
        allowed: true,
        hitCount: 0,
        limit: policy.max,
        retryAfterSeconds: 1,
      };
    }
  }

  return {
    checkInquiry: (bucketKey) => check(INQUIRY_BUCKET, bucketKey),
    checkContact: (bucketKey) => check(CONTACT_BUCKET, bucketKey),
  };
}

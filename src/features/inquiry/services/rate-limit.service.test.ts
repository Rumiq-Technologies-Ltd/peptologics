import { describe, expect, it, vi } from "vitest";

import { INQUIRY_RATE_LIMIT_MAX, INQUIRY_RATE_LIMIT_WINDOW_SECONDS } from "@/constants/business";
import type { RateLimitRepository } from "@/features/inquiry/services/rate-limit.repository";
import { createRateLimitService } from "@/features/inquiry/services/rate-limit.service";

/**
 * Rate limiting policy.
 *
 * The fail-open behaviour is the test that matters. It looks wrong in isolation — a
 * limiter that gives up when it breaks — and is right here for one specific reason,
 * recorded in ADR-022: the counter shares a database with the write it protects.
 */

function makeHarness(hitImpl?: RateLimitRepository["hit"]) {
  const hit = vi.fn(
    hitImpl ??
      (async () => ({
        allowed: true,
        hitCount: 1,
        limit: INQUIRY_RATE_LIMIT_MAX,
        retryAfterSeconds: 900,
      })),
  );

  return { service: createRateLimitService({ repository: { hit } }), hit };
}

describe("checkInquiry", () => {
  it("namespaces the bucket key and passes the configured limits", async () => {
    const { service, hit } = makeHarness();

    await service.checkInquiry("hashed-ip");

    expect(hit).toHaveBeenCalledWith(
      "inquiry:hashed-ip",
      INQUIRY_RATE_LIMIT_MAX,
      INQUIRY_RATE_LIMIT_WINDOW_SECONDS,
    );
  });

  it("passes a block straight through, including the retry window", async () => {
    const { service } = makeHarness(async () => ({
      allowed: false,
      hitCount: 6,
      limit: 5,
      retryAfterSeconds: 88,
    }));

    await expect(service.checkInquiry("hashed-ip")).resolves.toEqual({
      allowed: false,
      hitCount: 6,
      limit: 5,
      retryAfterSeconds: 88,
    });
  });

  it("fails open when the counter itself is unreachable", async () => {
    const { service } = makeHarness(async () => {
      throw new Error("database unreachable");
    });

    const verdict = await service.checkInquiry("hashed-ip");

    /*
     * Allowed, not blocked. The counter lives in the same database as the order, so if
     * it is down the insert cannot succeed either — blocking here would answer an
     * outage with a 429 that blames the visitor (ADR-022).
     */
    expect(verdict.allowed).toBe(true);
    expect(verdict.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});

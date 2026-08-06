import "server-only";

import { createHash } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Request-level security helpers for public endpoints.
 */

/**
 * Rejects cross-origin POSTs. The inquiry endpoint is only ever called by our
 * own form, so an Origin that is not ours is either a misconfigured client or an
 * abuse attempt. This is cheap defence-in-depth, not a substitute for validation.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  // Same-origin fetches from some clients omit Origin entirely; allow that
  // rather than breaking legitimate submissions.
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(env.NEXT_PUBLIC_SITE_URL).origin;
  } catch {
    return false;
  }
}

/**
 * Best-effort client IP. Vercel sets `x-forwarded-for`; the left-most entry is
 * the original client. Only ever used after hashing.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return request.headers.get("x-real-ip")?.trim() ?? "unknown";
}

/**
 * Salted SHA-256 of an IP address.
 *
 * The rate-limit table needs a stable per-client key, not an identity. Hashing
 * with a server-side salt gives us the counter without storing a raw address —
 * which would be PII we have no reason to hold.
 */
export function hashIp(ip: string): string {
  return createHash("sha256").update(`${env.RATE_LIMIT_SALT}:${ip}`).digest("hex");
}

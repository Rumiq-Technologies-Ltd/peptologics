/**
 * The client address used as a rate-limit key.
 *
 * Pure, and deliberately free of the env module, so the rule that picks the address can
 * be unit-tested on its own.
 *
 * Each proxy appends the address it received to `x-forwarded-for`. The **right-most**
 * entry is therefore the one our own edge recorded. The left-most entries are whatever the
 * visitor chose to send, and reading them would let a visitor present a fresh address,
 * and so a fresh rate-limit bucket, on every request (ADR-028).
 *
 * UNVERIFIED on Amplify. The rule assumed one proxy between the visitor and the function.
 * Amplify puts CloudFront and its own compute layer in the path, so the right-most entry
 * may be a CloudFront address shared by every visitor, which would put them all in one
 * rate-limit bucket. It has not been checked against a real request; the
 * `RATE_LIMIT_DIAGNOSTIC` log on POST /api/inquiries exists to settle it. Do not change
 * the rule until that result has been read.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    const last = forwarded.split(",").at(-1)?.trim();
    if (last) return last;
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

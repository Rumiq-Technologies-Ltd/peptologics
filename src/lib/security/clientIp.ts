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
 * This assumes one proxy (Vercel) between the visitor and the function. If a CDN is ever
 * placed in front, the right-most entry becomes the CDN's address, every visitor shares
 * one bucket, and this rule must be revisited.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    const last = forwarded.split(",").at(-1)?.trim();
    if (last) return last;
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

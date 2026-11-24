import { isIP } from "node:net";

/**
 * The client address used as a rate-limit key.
 *
 * Pure, and deliberately free of the env module, so the rule that picks the address can
 * be unit-tested on its own. It imports only `isIP`, and every caller runs on the Node
 * runtime.
 *
 * Behind Amplify Hosting a request passes through CloudFront and then the compute layer.
 * A live diagnostic on 2026-11-24 (two requests from one machine, no `x-forwarded-for` sent)
 * showed `x-forwarded-for` arriving as `<visitor>, <CloudFront edge>` (two entries), plus a
 * `cloudfront-viewer-address` header. The old right-most rule therefore keyed on the edge,
 * and every visitor behind one edge shared a bucket (ADR-028, amended).
 *
 * The order is:
 * 1. `cloudfront-viewer-address`, formatted `IP:port`. CloudFront sets it and overwrites any
 *    client-sent value, so it cannot be spoofed while the app is reachable only through
 *    CloudFront. For IPv6 the port still follows the last colon and there are no brackets.
 * 2. The second-from-right `x-forwarded-for` entry, which is the visitor as CloudFront
 *    recorded it. Entries further left are client-supplied and are never read. A single
 *    entry is used as it is.
 * 3. `x-real-ip`, then `"unknown"`.
 *
 * If the app were ever reachable without CloudFront, the viewer-address header and the
 * two-hop assumption would both stop holding, and this rule would need revisiting.
 */
export function getClientIp(request: Request): string {
  const viewerAddress = parseViewerAddress(request.headers.get("cloudfront-viewer-address"));
  if (viewerAddress) return viewerAddress;

  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (forwarded?.length) {
    return forwarded.length >= 2 ? forwarded[forwarded.length - 2] : forwarded[0];
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Strips the port from CloudFront's `IP:port` value; returns null unless an IP remains. */
function parseViewerAddress(value: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const portSeparator = trimmed.lastIndexOf(":");
  if (portSeparator === -1) return null;

  const address = trimmed.slice(0, portSeparator);
  return isIP(address) ? address : null;
}

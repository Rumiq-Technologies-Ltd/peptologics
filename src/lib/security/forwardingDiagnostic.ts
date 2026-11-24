/**
 * The shape of the forwarding headers on a request, for checking the client-IP rule behind
 * Amplify (see `clientIp.ts`).
 *
 * Reports how many `x-forwarded-for` entries arrived and which headers are present. It
 * never returns a header value: an IP address is personal data and must not reach a log
 * (CLAUDE.md, Logging). Pure, so it is unit-tested without a request.
 */

const DIAGNOSTIC_HEADERS = [
  "x-forwarded-for",
  "x-real-ip",
  "cloudfront-viewer-address",
  "x-amzn-trace-id",
] as const;

export interface ForwardingDiagnostic {
  /** Number of comma-separated entries in `x-forwarded-for`; 0 when absent. */
  xffEntryCount: number;
  /** Names of the diagnostic headers that are present. */
  presentHeaders: string[];
}

export function describeForwardingHeaders(headers: Headers): ForwardingDiagnostic {
  const forwarded = headers.get("x-forwarded-for");

  return {
    xffEntryCount: forwarded
      ? forwarded.split(",").filter((entry) => entry.trim() !== "").length
      : 0,
    presentHeaders: DIAGNOSTIC_HEADERS.filter((name) => headers.has(name)),
  };
}

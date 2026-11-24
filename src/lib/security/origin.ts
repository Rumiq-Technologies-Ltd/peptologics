/**
 * Whether an `Origin` header names this site.
 *
 * Pure, and deliberately free of the env module, so the rule can be unit-tested on its own
 * (the same reason `clientIp.ts` is).
 *
 * The apex and its `www.` twin both count as ours. The site answers on both hosts, and the
 * canonical URL names only one of them, so a visitor who arrives on the other host is a
 * legitimate caller. Comparing against a single host rejected every inquiry submitted from
 * it with a 403 the visitor could not act on.
 *
 * Everything else still has to match exactly: scheme, port, and the host once a leading
 * `www.` is removed. Lookalikes (`peptologics.com.evil.example`) and other subdomains
 * (`evil.peptologics.com`) are different hosts and are refused.
 */
export function isAllowedOrigin(origin: string, siteUrl: string): boolean {
  try {
    const requested = new URL(origin);
    const site = new URL(siteUrl);

    if (requested.protocol !== site.protocol || requested.port !== site.port) return false;

    return withoutWww(requested.hostname) === withoutWww(site.hostname);
  } catch {
    // An unparseable Origin, including the literal string "null", is never ours.
    return false;
  }
}

function withoutWww(hostname: string): string {
  return hostname.startsWith("www.") ? hostname.slice("www.".length) : hostname;
}

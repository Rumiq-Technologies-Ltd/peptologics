/**
 * The admin's Content Security Policy (ADR-038).
 *
 * Unlike the public site, the admin is dynamic on every request, so it can afford what the
 * public site's policy explains it cannot (see `next.config.ts`): a per-request nonce, and
 * no `'unsafe-inline'` for scripts. Next reads the nonce from this header and applies it to
 * its own scripts. The global policy still applies as well; the browser enforces both.
 */
export function buildAdminCsp(nonce: string, isDevelopment: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    // Next and Tailwind inject style tags; style injection is a far smaller risk than script.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    // The sign-in redirect leaves our origin by a 302, which form-action does not govern.
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

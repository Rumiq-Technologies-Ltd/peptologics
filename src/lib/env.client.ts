/**
 * Client-safe environment values.
 *
 * Only `NEXT_PUBLIC_*` variables belong here. Every value in this module is
 * inlined into the browser bundle at build time, so nothing secret may be added.
 *
 * Client Components must import from here, never from `@/lib/env` — ESLint
 * enforces that boundary.
 */

/** Absolute site origin without a trailing slash. */
export const siteUrl: string = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

/** Public contact email, shown in the footer and on the contact page. */
export const contactEmail: string | undefined = process.env.NEXT_PUBLIC_CONTACT_EMAIL || undefined;

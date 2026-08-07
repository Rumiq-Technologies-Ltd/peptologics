/**
 * Business rules and limits.
 *
 * Values marked PLACEHOLDER are engineering guardrails, not policy the client
 * has confirmed. They are recorded in docs/decisions.md as open questions.
 */

/** Currency for all pricing. Confirmed as USD from the source price list. */
export const CURRENCY = "USD" as const;

/** Maximum quantity of a single product on one inquiry. PLACEHOLDER. */
export const MAX_LINE_QUANTITY = 99 as const;

/** Maximum distinct products on one inquiry. PLACEHOLDER. */
export const MAX_DISTINCT_LINES = 25 as const;

/** Minimum quantity once a product is on the list. Removing sets it to zero. */
export const MIN_LINE_QUANTITY = 1 as const;

/**
 * Rate limiting for the public inquiry endpoint: a fixed window, keyed on a
 * hashed IP. Generous enough that a genuine visitor correcting mistakes is never
 * blocked, tight enough to stop a script filling the inbox.
 */
export const INQUIRY_RATE_LIMIT_MAX = 5 as const;
export const INQUIRY_RATE_LIMIT_WINDOW_SECONDS = 900 as const;

/**
 * Minimum seconds between form mount and submit. Bots post instantly; a human
 * filling eight fields cannot. Failing this check returns a silent success so
 * the bot learns nothing.
 */
export const MIN_FORM_DWELL_SECONDS = 3 as const;

/** Timeouts for third-party calls, in milliseconds. */
export const EMAIL_TIMEOUT_MS = 8_000 as const;

/** Retry budget for transient notification failures. */
export const NOTIFICATION_RETRY_ATTEMPTS = 3 as const;

/**
 * Catalog pages revalidate every 3600 seconds (one hour).
 *
 * Deliberately not a constant. Next requires segment config exports to be
 * statically analyzable, so `export const revalidate` cannot reference an
 * imported value or an expression — a non-literal fails the build with "Invalid
 * segment configuration export detected". The literal is inlined at each route
 * with a comment; this note records why it is duplicated rather than shared.
 */

/** Products shown in the featured strip on the home page. */
export const FEATURED_PRODUCT_LIMIT = 6 as const;

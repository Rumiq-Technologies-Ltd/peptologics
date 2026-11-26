import { COA_REPORT_ID_PATTERN } from "@/lib/dynamodb/entities";

/** Far longer than any real ID. Stops a huge string being normalised before it is rejected. */
const MAX_RAW_LENGTH = 100;

/**
 * Turns whatever a visitor typed, or a URL segment carried, into the canonical report ID, or
 * `null` if it cannot be one.
 *
 * Trims, upper-cases and removes inner whitespace, so `coa 9405` finds `COA9405`. Anything
 * outside letters, digits and hyphens is refused, which also means the result is always safe
 * to put in a database key and in a URL.
 */
export function normalizeReportId(raw: string): string | null {
  if (raw.length > MAX_RAW_LENGTH) return null;

  const normalized = raw.normalize("NFKC").trim().toUpperCase().replace(/\s+/g, "");

  return COA_REPORT_ID_PATTERN.test(normalized) ? normalized : null;
}

/**
 * Input normalisation applied before validation.
 *
 * This is not XSS defence — React escapes by default and we never use
 * `dangerouslySetInnerHTML`. Its job is to strip the invisible junk that gets
 * pasted into forms (control characters, zero-width spaces, non-breaking spaces)
 * so it never reaches the database or an email template.
 *
 * Character classes are written as explicit `\u` escapes rather than literal
 * bytes so they survive copy/paste, diffs, and editor encoding changes.
 */

/** C0 controls except tab (09), LF (0A) and CR (0D); plus DEL and the C1 block. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

/**
 * Zero-width and directional formatting characters. These are invisible but
 * count toward length limits and can be used to smuggle lookalike input.
 */
const INVISIBLE_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

/** Non-breaking and typographic spaces that should behave as a plain space. */
const EXOTIC_SPACES = /[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g;

function stripInvisible(value: string): string {
  return value.replace(CONTROL_CHARS, "").replace(INVISIBLE_CHARS, "");
}

/** Trims, collapses runs of whitespace, and removes control/invisible characters. */
export function sanitizeText(value: string): string {
  return stripInvisible(value).replace(EXOTIC_SPACES, " ").replace(/\s+/g, " ").trim();
}

/**
 * Same as `sanitizeText` but preserves line breaks — for the notes textarea,
 * where paragraph structure is meaningful. Caps consecutive blank lines at one.
 */
export function sanitizeMultilineText(value: string): string {
  return stripInvisible(value)
    .replace(EXOTIC_SPACES, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Normalises an email for storage: sanitised and lowercased.
 *
 * The local part is technically case-sensitive per RFC 5321, but no real
 * provider treats it that way, and lowercasing is what makes duplicate-lead
 * detection work.
 */
export function sanitizeEmail(value: string): string {
  return sanitizeText(value).toLowerCase();
}

/**
 * Keeps only digits, '+', and common separators so display formatting survives.
 *
 * Sanitised, filtered, then sanitised again. The second pass is not redundant:
 * stripping the letters from "+1 555 0102030 ext" leaves a trailing space, which would
 * otherwise be stored and shown. Caught by a unit test.
 */
export function sanitizePhone(value: string): string {
  return sanitizeText(sanitizeText(value).replace(/[^\d+()\-.\s]/g, ""));
}

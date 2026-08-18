/**
 * The pieces every inquiry email template shares.
 *
 * There are two templates — the internal notification and the customer confirmation —
 * and they have opposite audiences but identical mechanics: build a subject, a plain-text
 * body and an HTML body, interpolating values that came from a form.
 *
 * `escapeHtml` lives here rather than being copied into each template because a second
 * private copy of a security-critical function is exactly how the two drift: a fix
 * applied to one and forgotten in the other is invisible in review. One definition, two
 * importers, and the escaping is a visible call at every insertion point.
 */

/** Escapes the five characters that can break out of HTML text or an attribute. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * One rendered message.
 *
 * Both bodies are always produced. Text is not a courtesy — some corporate mail clients
 * strip HTML entirely, and a message that arrives blank is worse than no message at all.
 */
export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

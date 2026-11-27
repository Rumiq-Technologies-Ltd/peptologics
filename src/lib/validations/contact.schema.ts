import { z } from "zod";

import { inquiryCustomerSchema, sanitizedText } from "@/lib/validations/inquiry.schema";
import { sanitizeMultilineText } from "@/lib/security/sanitize";

/**
 * The contact-form contract, shared by the browser form and `POST /api/contact`.
 *
 * Built from the inquiry form's pieces rather than beside them: the name goes through the
 * same sanitiser, and the email *is* the inquiry schema's email, so an address one form
 * accepts is an address the other accepts. That email rule trims, lowercases, strips
 * control characters and collapses whitespace before `z.email` runs, which is also what
 * keeps a CR or LF out of the `Reply-To` header the company email carries.
 *
 * Like the inquiry schema it is `string in, string out` and free of React and Next imports.
 */

export const CONTACT_NAME_MAX_LENGTH = 100 as const;
export const CONTACT_MESSAGE_MIN_LENGTH = 10 as const;
export const CONTACT_MESSAGE_MAX_LENGTH = 5000 as const;

const MESSAGE_TOO_SHORT = `Please write at least ${CONTACT_MESSAGE_MIN_LENGTH} characters so we can understand your question.`;
const MESSAGE_TOO_LONG = `Please shorten your message to ${CONTACT_MESSAGE_MAX_LENGTH} characters or fewer.`;

/** The fields the visitor fills in. This is what the form validates. */
export const contactFieldsSchema = z.object({
  name: sanitizedText({
    min: 1,
    max: CONTACT_NAME_MAX_LENGTH,
    requiredError: "Enter your name.",
    tooLongError: `Please shorten your name to ${CONTACT_NAME_MAX_LENGTH} characters or fewer.`,
  }),

  email: inquiryCustomerSchema.shape.email,

  /**
   * Line breaks are meaningful, so this keeps them. Measured again after sanitising:
   * ten zero-width characters pass a raw `min(10)` and leave an empty message behind.
   */
  message: z
    .string({ error: "Enter your message." })
    .trim()
    .min(CONTACT_MESSAGE_MIN_LENGTH, { error: MESSAGE_TOO_SHORT })
    .max(CONTACT_MESSAGE_MAX_LENGTH, { error: MESSAGE_TOO_LONG })
    .transform(sanitizeMultilineText)
    .pipe(
      z
        .string()
        .min(CONTACT_MESSAGE_MIN_LENGTH, { error: MESSAGE_TOO_SHORT })
        .max(CONTACT_MESSAGE_MAX_LENGTH, { error: MESSAGE_TOO_LONG }),
    ),
});

/**
 * The complete request body for `POST /api/contact`.
 *
 * `honeypot` and `formElapsedMs` are anti-spam signals, not visitor data, and are
 * deliberately not validated strictly: a schema that rejected a filled honeypot would tell
 * a bot which field trapped it. The service decides what to do with them.
 */
export const contactRequestSchema = contactFieldsSchema.extend({
  /** Must stay empty. Visible only to something that fills every input it finds. */
  honeypot: z.string().max(200).optional(),
  /** Milliseconds from form mount to submit, measured in the browser (ADR-028). */
  formElapsedMs: z.number().int().nonnegative().optional(),
});

/** What the form holds while the visitor types. */
export type ContactFormValues = z.input<typeof contactFieldsSchema>;
/** What the schema produces: trimmed and sanitised. */
export type ContactFields = z.output<typeof contactFieldsSchema>;
export type ContactRequest = z.output<typeof contactRequestSchema>;

import { z } from "zod";

import { MAX_DISTINCT_LINES, MAX_LINE_QUANTITY, MIN_LINE_QUANTITY } from "@/constants/business";
import {
  sanitizeEmail,
  sanitizeMultilineText,
  sanitizePhone,
  sanitizeText,
} from "@/lib/security/sanitize";

/**
 * The inquiry contract, shared by the browser form and the Route Handler.
 *
 * One schema imported by both is what makes client and server validation agree by
 * construction rather than by review. The module is deliberately free of React and
 * Next imports — ESLint enforces that — so importing it into the form costs the
 * client bundle nothing but Zod, which the form needs anyway.
 *
 * **There is no price field, anywhere in here.** The request carries product IDs and
 * quantities; the server reads `products.price_cents` itself and computes every
 * figure. A payload cannot express a price, so a tampered one cannot be believed
 * (ADR-005).
 *
 * Length bounds mirror the CHECK constraints on `orders` exactly. The database is the
 * last line of defence, not the first, and the two must not disagree — a value that
 * passed here and failed there would surface as a 500 where a field error belongs.
 *
 * Every field is `string in, string out`. That matters for React Hook Form: a
 * `z.preprocess` wrapper would widen the input type to `unknown` and the resolver
 * would stop type-checking the form's own values. Sanitising with `.transform()` and
 * re-checking with `.pipe()` keeps the input type honest while still guaranteeing the
 * server stores normalised text.
 */

/**
 * A required text field: trimmed, measured, sanitised, then measured again.
 *
 * The second measurement is not redundant. Two hundred zero-width characters trim to
 * a non-empty string and pass `min(1)`, but sanitising strips them all and leaves
 * `""` — which would store an empty name. The `.pipe()` catches exactly that.
 */
function sanitizedText(options: {
  min: number;
  max: number;
  requiredError: string;
  tooLongError: string;
}) {
  return z
    .string({ error: options.requiredError })
    .trim()
    .min(options.min, { error: options.requiredError })
    .max(options.max, { error: options.tooLongError })
    .transform(sanitizeText)
    .pipe(
      z
        .string()
        .min(options.min, { error: options.requiredError })
        .max(options.max, { error: options.tooLongError }),
    );
}

/** Optional text: an empty or whitespace-only value becomes `undefined`, never `""`. */
function optionalSanitizedText(max: number, tooLongError: string) {
  return z
    .string()
    .max(max, { error: tooLongError })
    .optional()
    .transform((value) => {
      const cleaned = value ? sanitizeText(value) : "";
      return cleaned === "" ? undefined : cleaned;
    });
}

/**
 * The fields the visitor actually fills in.
 *
 * Required set confirmed by the client: name, email, phone, street address, city,
 * state and ZIP. Apartment and notes are the only optional fields.
 */
export const inquiryCustomerSchema = z.object({
  name: sanitizedText({
    min: 1,
    max: 200,
    requiredError: "Enter your full name.",
    tooLongError: "Please shorten your name to 200 characters or fewer.",
  }),

  email: z
    .string({ error: "Enter your email address." })
    .trim()
    .min(5, { error: "Enter a valid email address, for example name@example.com." })
    .max(254, { error: "That email address is too long." })
    .transform(sanitizeEmail)
    .pipe(z.email({ error: "Enter a valid email address, for example name@example.com." })),

  phone: z
    .string({ error: "Enter a phone number we can reach you on." })
    .trim()
    .min(7, { error: "Enter a phone number of at least 7 digits." })
    .max(32, { error: "That phone number is too long." })
    .transform(sanitizePhone)
    .pipe(
      z
        .string()
        .min(7, { error: "Enter a phone number of at least 7 digits." })
        .max(32, { error: "That phone number is too long." }),
    ),

  address: sanitizedText({
    min: 1,
    max: 300,
    requiredError: "Enter your street address.",
    tooLongError: "Please shorten your address to 300 characters or fewer.",
  }),

  apartment: optionalSanitizedText(120, "Please shorten this to 120 characters or fewer."),

  city: sanitizedText({
    min: 1,
    max: 120,
    requiredError: "Enter your city.",
    tooLongError: "Please shorten your city to 120 characters or fewer.",
  }),

  state: sanitizedText({
    min: 2,
    max: 100,
    requiredError: "Enter your state or province.",
    tooLongError: "Please shorten this to 100 characters or fewer.",
  }),

  zipCode: sanitizedText({
    min: 3,
    max: 20,
    requiredError: "Enter your ZIP or postal code.",
    tooLongError: "That ZIP or postal code is too long.",
  }),

  /** Line breaks are meaningful here, so this one keeps them. */
  notes: z
    .string()
    .max(2000, { error: "Please shorten your notes to 2000 characters or fewer." })
    .optional()
    .transform((value) => {
      const cleaned = value ? sanitizeMultilineText(value) : "";
      return cleaned === "" ? undefined : cleaned;
    }),
});

/** One requested product. Quantity only — the price is the server's business. */
export const inquiryItemSchema = z.object({
  productId: z.uuid({ error: "That product reference is not valid." }),
  quantity: z
    .number({ error: "Enter a quantity." })
    .int({ error: "Quantities must be whole numbers." })
    .min(MIN_LINE_QUANTITY, { error: `Quantities start at ${MIN_LINE_QUANTITY}.` })
    .max(MAX_LINE_QUANTITY, { error: `The maximum quantity per product is ${MAX_LINE_QUANTITY}.` }),
});

/**
 * The complete request body for `POST /api/inquiries`.
 *
 * `honeypot` and `formStartedAt` are anti-spam signals rather than customer data, and
 * neither is validated strictly here on purpose: a schema that rejected a filled
 * honeypot would tell a bot exactly which field trapped it. The service decides what
 * to do with them, and its answer to a bot is an ordinary success.
 */
export const inquirySchema = z.object({
  customer: inquiryCustomerSchema,

  items: z
    .array(inquiryItemSchema)
    .min(1, { error: "Add at least one product to your inquiry list." })
    .max(MAX_DISTINCT_LINES, {
      error: `An inquiry can include at most ${MAX_DISTINCT_LINES} different products.`,
    })
    // The database enforces one row per product per order, so a duplicate would
    // otherwise fail as a constraint violation — a 500 where a field error belongs.
    .refine((items) => new Set(items.map((item) => item.productId)).size === items.length, {
      error: "Each product should appear only once, with its quantity.",
    }),

  /** Must stay empty. Visible only to something that fills every input it finds. */
  honeypot: z.string().max(200).optional(),

  /**
   * Epoch milliseconds when the form mounted, for the dwell-time check.
   *
   * Client-supplied and therefore forgeable — a bot that sets it to five seconds ago
   * passes. It is a cheap filter against the far more common case, a script that posts
   * the instant it parses the form, and it is not the only defence.
   */
  formStartedAt: z.number().int().positive().optional(),

  /** When the visitor accepted the Research-Use-Only gate, if the record survived. */
  ruoAcknowledgedAt: z.iso.datetime().optional(),
});

/** What the form holds while the visitor types. */
export type InquiryCustomerFormValues = z.input<typeof inquiryCustomerSchema>;
/** What the schema produces: trimmed, sanitised, with empty optionals dropped. */
export type InquiryCustomerInput = z.output<typeof inquiryCustomerSchema>;
export type InquiryItemInput = z.output<typeof inquiryItemSchema>;
export type InquiryInput = z.output<typeof inquirySchema>;

/**
 * Flattens Zod issues into the shape `ServiceFailure.fieldErrors` and the API envelope
 * both expect, with dotted paths (`customer.email`) so the form can map a server-side
 * message back onto the field that caused it.
 */
export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".") || "form";
    fieldErrors[path] = [...(fieldErrors[path] ?? []), issue.message];
  }

  return fieldErrors;
}

import { z } from "zod";

import { ORDER_STATUSES } from "@/features/admin/orders/types";
import { sanitizeMultilineText } from "@/lib/security/sanitize";

/** Longest staff note, in characters. */
export const MAX_NOTE_LENGTH = 2000;

/** `PL-` and at least four digits: the shape the order counter issues. */
export const ORDER_NUMBER_PATTERN = /^PL-\d{4,}$/;

export const orderStatusSchema = z.enum(ORDER_STATUSES);

/** A note's text, cleaned first so the length limit counts what is stored. */
export const noteBodySchema = z
  .string()
  .transform(sanitizeMultilineText)
  .pipe(
    z
      .string()
      .min(1, "Write something before adding the note.")
      .max(MAX_NOTE_LENGTH, `Keep the note under ${MAX_NOTE_LENGTH} characters.`),
  );

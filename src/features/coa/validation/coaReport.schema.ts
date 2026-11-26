import { z } from "zod";

import { COA_LABS, isCoaLabId } from "@/features/coa/constants/labs";
import { normalizeReportId } from "@/features/coa/utils/normalizeReportId";

/**
 * The contract for a report as staff write it (`data/coa/<report id>.json`) and as the
 * publish script checks it before anything reaches the table.
 *
 * Field names are the storage names (snake_case) on purpose: what a person types is what is
 * stored, so there is no second vocabulary to mistranslate. `version`, `created_at` and
 * `updated_at` are deliberately absent. The publisher assigns the version and the database
 * layer stamps the times, so a manifest cannot forge either.
 *
 * Every figure here is transcribed from the laboratory's own report. Nothing is computed.
 */

const CONTROL_CHARACTERS = /\p{Cc}/u;

/** A visible text field: trimmed, bounded, and free of control characters. */
function text(max: number) {
  return z
    .string()
    .trim()
    .min(1, "Required.")
    .max(max, `At most ${max} characters.`)
    .refine((value) => !CONTROL_CHARACTERS.test(value), "Control characters are not allowed.");
}

/** A report ID, normalised the same way a visitor's lookup is. */
const reportIdField = z
  .string()
  .transform((value) => normalizeReportId(value) ?? "")
  .refine((value) => value !== "", "Not a valid report ID: letters, digits and hyphens only.");

/** `/coa/<REPORT_ID>/<file>.<ext>`; the ID segment is checked against the report below. */
const COA_FILE_PATH = /^\/coa\/([A-Z0-9-]+)\/[a-z0-9][a-z0-9._-]*\.(?:webp|jpe?g|png)$/;

const LOT_NUMBER = /^[A-Z0-9][A-Z0-9._-]{2,39}$/;
const VERIFICATION_CODE = /^[A-Z0-9][A-Z0-9-]{3,39}$/;

const outcomeField = z.enum(["met", "not_met", "not_applicable"]);

const resultRowSchema = z.object({
  test: text(80),
  method: text(120),
  specification: text(160),
  result: text(160),
  outcome: outcomeField,
});

const chromatogramSchema = z.object({
  path: z.string(),
  caption: text(160),
  alt: text(200),
});

export const coaReportContentSchema = z
  .object({
    report_id: reportIdField,
    lab_id: z.string().refine(isCoaLabId, "Not a registered laboratory."),
    lab_verification_code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(VERIFICATION_CODE, "Not a valid verification code.")
      .optional(),
    product_id: z.uuid("Must be the product's id."),
    compound_name: text(80),
    lot_number: z
      .string()
      .trim()
      .toUpperCase()
      .regex(LOT_NUMBER, "Not a valid lot number: letters, digits, dot, dash, underscore."),
    tested_strength_mg: z.number().positive().max(100_000),
    tested_strength_unit: z.enum(["mg", "ml"]),
    sample_received_on: z.iso.date().optional(),
    issued_on: z.iso.date(),
    purity_percent: z.number().min(0).max(100).optional(),
    net_content_mg: z.number().positive().max(100_000).optional(),
    results: z.array(resultRowSchema).min(1, "At least one result row.").max(30),
    chromatograms: z.array(chromatogramSchema).max(8).default([]),
    scan_path: z.string(),
    status: z.enum(["active", "withdrawn", "superseded"]).default("active"),
    superseded_by: reportIdField.optional(),
    change_note: text(500).optional(),
  })
  .superRefine((report, context) => {
    const issue = (path: (string | number)[], message: string) =>
      context.addIssue({ code: "custom", path, message });

    const pathMatchesReport = (value: string) =>
      COA_FILE_PATH.exec(value)?.[1] === report.report_id;

    if (!pathMatchesReport(report.scan_path)) {
      issue(["scan_path"], `Must be /coa/${report.report_id}/<file>.webp (or jpg, png).`);
    }

    report.chromatograms.forEach((chromatogram, index) => {
      if (!pathMatchesReport(chromatogram.path)) {
        issue(["chromatograms", index, "path"], `Must be under /coa/${report.report_id}/.`);
      }
    });

    if (report.sample_received_on && report.sample_received_on > report.issued_on) {
      issue(["issued_on"], "A report cannot be issued before the sample was received.");
    }

    if (report.status === "superseded" && !report.superseded_by) {
      issue(["superseded_by"], "A superseded report must name the report that replaces it.");
    }

    if (report.status !== "superseded" && report.superseded_by) {
      issue(["superseded_by"], "Only a superseded report names a replacement.");
    }

    if (report.superseded_by === report.report_id) {
      issue(["superseded_by"], "A report cannot supersede itself.");
    }

    if (report.status !== "active" && !report.change_note) {
      issue(["change_note"], "Say why the report is not active; this is shown publicly.");
    }
  });

/** A validated manifest. The input type differs only by the defaults above. */
export type CoaReportContent = z.output<typeof coaReportContentSchema>;

/** Which lab a report belongs to, for callers that need the registered entry. */
export function labOf(content: Pick<CoaReportContent, "lab_id">) {
  return COA_LABS[content.lab_id as keyof typeof COA_LABS];
}

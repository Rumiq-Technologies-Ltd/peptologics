import { toCoaVersionSource } from "@/features/coa/mappers/coa.mappers";
import { checkPurityRule } from "@/features/coa/utils/coaRules";
import {
  coaReportContentSchema,
  type CoaReportContent,
} from "@/features/coa/validation/coaReport.schema";
import { buildCoaVersionItem, keys, type Item, type TableKey } from "@/lib/dynamodb/entities";

/**
 * Decides what publishing a report would do, without touching anything.
 *
 * Pure on purpose: every input (the manifest, the latest stored version, the product, the
 * clock) is passed in, so each rule is a unit test and the script's dry run is the same code
 * path as the real write. Nothing here imports the AWS SDK, `server-only` or React, because
 * the publish script runs this under plain Node.
 */

/** A stored report version as read back from the table. Untyped beyond its keys. */
export type StoredCoaVersion = Record<string, unknown>;

/** What a manifest's `product_id` resolves to in the target table. */
export interface PublishProduct {
  id: string;
  slug: string;
  name: string;
  category: string;
  strengthMg: number;
  strengthUnit: string;
}

export interface PublishInputs {
  content: CoaReportContent;
  /** The highest stored version of this report, or null if it has never been published. */
  latest: StoredCoaVersion | null;
  /** Null when the manifest's product does not exist in this table. */
  product: PublishProduct | null;
  /** For a superseded report: whether the replacement report exists. Null when not needed. */
  replacementExists: boolean | null;
  now: string;
}

/** What the dry run shows a person, so they can compare it with the lab's own report. */
export interface PublishSummary {
  reportId: string;
  version: number;
  status: string;
  lab: string;
  compound: string;
  lot: string;
  product: string;
  /** Plain-language notes that are not errors (for example a different tested strength). */
  notes: string[];
}

export type PublishPlan =
  | { kind: "blocked"; problems: string[] }
  | { kind: "unchanged"; reportId: string; version: number }
  | {
      kind: "write";
      reportId: string;
      version: number;
      /** The version whose current-version marker must be removed in the same transaction. */
      previousKey: TableKey | null;
      item: Item;
      summary: PublishSummary;
    };

/** Fields that identify a report. They cannot change in an amendment. */
const IMMUTABLE_FIELDS = ["lab_id", "lot_number"] as const;

/**
 * The manifest fields compared to decide whether a re-run changes anything. `change_note` is
 * left out: the reason for a change is not itself a change to the report.
 */
const COMPARABLE_FIELDS = [
  "report_id",
  "lab_id",
  "lab_verification_code",
  "product_id",
  "compound_name",
  "lot_number",
  "tested_strength_mg",
  "tested_strength_unit",
  "sample_received_on",
  "issued_on",
  "purity_percent",
  "net_content_mg",
  "results",
  "chromatograms",
  "scan_path",
  "status",
  "superseded_by",
] as const;

/** JSON with object keys sorted, so two equal values always serialise identically. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined && entry !== null)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, entry]) => `${JSON.stringify(name)}:${canonicalJson(entry)}`);

    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(value);
}

function comparable(source: Record<string, unknown>): string {
  const picked: Record<string, unknown> = {};
  for (const field of COMPARABLE_FIELDS) picked[field] = source[field];

  // A manifest that omits `chromatograms` and a stored item that has none are the same.
  if (Array.isArray(picked.chromatograms) && picked.chromatograms.length === 0) {
    delete picked.chromatograms;
  }

  return canonicalJson(picked);
}

function storedVersion(latest: StoredCoaVersion): number {
  return typeof latest.version === "number" ? latest.version : 0;
}

/** Everything that must hold before a report may be written, as plain sentences. */
function collectProblems(inputs: PublishInputs, isChange: boolean): string[] {
  const { content, latest, product, replacementExists } = inputs;
  const problems: string[] = [];

  if (!product) {
    problems.push(`product_id ${content.product_id} does not exist in this table.`);
  } else {
    problems.push(
      ...checkPurityRule({
        category: product.category,
        status: content.status,
        purityPercent: content.purity_percent ?? null,
      }),
    );
  }

  if (content.status === "superseded" && replacementExists === false) {
    problems.push(`The replacement report ${content.superseded_by} has not been published.`);
  }

  if (latest) {
    for (const field of IMMUTABLE_FIELDS) {
      if (latest[field] !== content[field]) {
        problems.push(
          `${field} cannot change on a published report. Withdraw it and publish a new one.`,
        );
      }
    }

    if (isChange && !content.change_note) {
      problems.push(
        "This report is already published. An amendment needs a change_note saying what changed; it is shown publicly.",
      );
    }
  }

  return problems;
}

function notesFor(content: CoaReportContent, product: PublishProduct): string[] {
  const notes: string[] = [];

  if (
    content.tested_strength_mg !== product.strengthMg ||
    content.tested_strength_unit !== product.strengthUnit
  ) {
    notes.push(
      `Tested strength ${content.tested_strength_mg} ${content.tested_strength_unit} differs from the product's ${product.strengthMg} ${product.strengthUnit}; it will be labelled "Previous ${content.tested_strength_mg} ${content.tested_strength_unit} lot".`,
    );
  }

  if (content.compound_name.toLowerCase() !== product.name.toLowerCase()) {
    notes.push(
      `Compound "${content.compound_name}" differs from the product name "${product.name}".`,
    );
  }

  return notes;
}

export function planPublish(inputs: PublishInputs): PublishPlan {
  const { content, latest, product, now } = inputs;

  const isUnchanged =
    latest !== null &&
    comparable(latest) === comparable(content as unknown as Record<string, unknown>);

  // An identical re-run needs no reason; only a real change does.
  const problems = collectProblems(inputs, !isUnchanged);
  if (problems.length > 0) return { kind: "blocked", problems };

  if (latest && isUnchanged) {
    return { kind: "unchanged", reportId: content.report_id, version: storedVersion(latest) };
  }

  const version = latest ? storedVersion(latest) + 1 : 1;
  const item = buildCoaVersionItem(toCoaVersionSource(content, version), { current: true, now });

  return {
    kind: "write",
    reportId: content.report_id,
    version,
    previousKey: latest ? keys.coaVersion(content.report_id, storedVersion(latest)) : null,
    item,
    summary: {
      reportId: content.report_id,
      version,
      status: content.status,
      lab: content.lab_id,
      compound: content.compound_name,
      lot: content.lot_number,
      product: product ? `${product.name} (${product.slug})` : content.product_id,
      notes: product ? notesFor(content, product) : [],
    },
  };
}

/**
 * Turns the latest stored version back into a manifest with a new status and reason, for
 * withdrawing or superseding. The result goes through the same schema as any manifest, so
 * every rule (a reason is required, a replacement is named) applies unchanged.
 */
export function contentWithStatus(
  latest: StoredCoaVersion,
  change: { status: "withdrawn" | "superseded"; reason: string; supersededBy?: string },
): { success: true; content: CoaReportContent } | { success: false; problems: string[] } {
  const fields: Record<string, unknown> = {};
  for (const field of COMPARABLE_FIELDS) fields[field] = latest[field];

  const parsed = coaReportContentSchema.safeParse({
    ...fields,
    status: change.status,
    superseded_by: change.status === "superseded" ? change.supersededBy : undefined,
    change_note: change.reason,
  });

  if (!parsed.success) {
    return {
      success: false,
      problems: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "report"}: ${issue.message}`,
      ),
    };
  }

  return { success: true, content: parsed.data };
}

/**
 * Files a manifest points at that are not on disk. Publishing refuses until they exist: the
 * files ship in the pull request and the data is written after, so a record can never point
 * at an image that is not deployed.
 */
export function findMissingFiles(
  content: Pick<CoaReportContent, "scan_path" | "chromatograms">,
  fileExists: (sitePath: string) => boolean,
): string[] {
  const paths = [content.scan_path, ...content.chromatograms.map((image) => image.path)];
  return paths.filter((sitePath) => !fileExists(sitePath));
}

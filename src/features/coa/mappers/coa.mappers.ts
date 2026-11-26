import { isCoaLabId } from "@/features/coa/constants/labs";
import type { CoaReportContent } from "@/features/coa/validation/coaReport.schema";
import type {
  CoaChromatogram,
  CoaOutcome,
  CoaReport,
  CoaReportSummary,
  CoaResultRow,
  CoaStatus,
  CoaStrengthUnit,
  CoaVersionEntry,
} from "@/features/coa/types/coa";
import { toAssetPath } from "@/features/products/mappers/product.mappers";
import type { CoaVersionSource } from "@/lib/dynamodb/entities";

/**
 * The single boundary between a stored report version and the domain shape.
 *
 * Reads are defensive in one direction only: a value that cannot be trusted degrades toward
 * *less* claim, never more. An unknown status reads as `withdrawn` (not `active`), an
 * unknown outcome as `not_applicable` (not `met`), and a record missing something a page
 * cannot do without is dropped (`null`) rather than shown half-formed.
 */

/** The attributes a stored version can carry. All optional: absent means null. */
export interface CoaRecord {
  report_id?: string;
  version?: number;
  status?: string;
  superseded_by?: string;
  change_note?: string;
  lab_id?: string;
  lab_verification_code?: string;
  product_id?: string;
  compound_name?: string;
  lot_number?: string;
  tested_strength_mg?: number;
  tested_strength_unit?: string;
  sample_received_on?: string;
  issued_on?: string;
  purity_percent?: number;
  net_content_mg?: number;
  results?: {
    test?: string;
    method?: string;
    specification?: string;
    result?: string;
    outcome?: string;
  }[];
  chromatograms?: { path?: string; caption?: string; alt?: string }[];
  scan_path?: string;
  updated_at?: string;
}

const STATUSES: readonly CoaStatus[] = ["active", "withdrawn", "superseded"];
const OUTCOMES: readonly CoaOutcome[] = ["met", "not_met", "not_applicable"];
const UNITS: readonly CoaStrengthUnit[] = ["mg", "ml"];

function toEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return (allowed as readonly string[]).includes(value ?? "") ? (value as T) : fallback;
}

function toResultRow(row: NonNullable<CoaRecord["results"]>[number]): CoaResultRow {
  return {
    test: row.test ?? "",
    method: row.method ?? "",
    specification: row.specification ?? "",
    result: row.result ?? "",
    outcome: toEnum(row.outcome, OUTCOMES, "not_applicable"),
  };
}

/**
 * A certificate file is always one of ours, under `/coa/`. `toAssetPath` also admits https URLs
 * (right for catalog photography); here that would let a stored record point a visitor's
 * browser at someone else's server, so only a site path passes.
 */
function toSitePath(value: string | null | undefined): string | null {
  const path = toAssetPath(value ?? null);
  return path?.startsWith("/") ? path : null;
}

/** Drops an image whose path is not a site path: an `<img>` must never point off-site. */
function toChromatograms(rows: CoaRecord["chromatograms"]): CoaChromatogram[] {
  return (rows ?? []).flatMap((row) => {
    const path = toSitePath(row.path);
    return path ? [{ path, caption: row.caption ?? "", alt: row.alt ?? "" }] : [];
  });
}

export function toCoaReportSummary(record: CoaRecord): CoaReportSummary | null {
  if (
    !record.report_id ||
    record.version === undefined ||
    !record.product_id ||
    !record.compound_name ||
    !record.lot_number ||
    !record.issued_on ||
    record.tested_strength_mg === undefined ||
    !record.lab_id ||
    !isCoaLabId(record.lab_id)
  ) {
    return null;
  }

  return {
    reportId: record.report_id,
    version: record.version,
    // Unknown reads as withdrawn: a record we cannot interpret must not look current.
    status: toEnum(record.status, STATUSES, "withdrawn"),
    supersededBy: record.superseded_by ?? null,
    labId: record.lab_id,
    productId: record.product_id,
    compoundName: record.compound_name,
    lotNumber: record.lot_number,
    testedStrengthMg: record.tested_strength_mg,
    testedStrengthUnit: toEnum(record.tested_strength_unit, UNITS, "mg"),
    issuedOn: record.issued_on,
    purityPercent: record.purity_percent ?? null,
  };
}

export function toCoaReport(record: CoaRecord): CoaReport | null {
  const summary = toCoaReportSummary(record);
  if (!summary) return null;

  return {
    ...summary,
    labVerificationCode: record.lab_verification_code ?? null,
    sampleReceivedOn: record.sample_received_on ?? null,
    netContentMg: record.net_content_mg ?? null,
    changeNote: record.change_note ?? null,
    results: (record.results ?? []).map(toResultRow),
    chromatograms: toChromatograms(record.chromatograms),
    scanPath: toSitePath(record.scan_path),
    updatedAt: record.updated_at ?? null,
  };
}

export function toCoaVersionEntry(record: CoaRecord): CoaVersionEntry | null {
  if (record.version === undefined) return null;

  return {
    version: record.version,
    status: toEnum(record.status, STATUSES, "withdrawn"),
    changeNote: record.change_note ?? null,
    issuedOn: record.issued_on ?? null,
    updatedAt: record.updated_at ?? null,
  };
}

/** A validated manifest plus the version the publisher assigned, in storage terms. */
export function toCoaVersionSource(content: CoaReportContent, version: number): CoaVersionSource {
  return {
    ...content,
    version,
    results: content.results,
    chromatograms: content.chromatograms,
  };
}

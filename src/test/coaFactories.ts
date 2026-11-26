import type { CoaRecord } from "@/features/coa/mappers/coa.mappers";
import type { CoaReport, CoaReportSummary } from "@/features/coa/types/coa";

export const COA_PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

/**
 * A manifest as a person would write it, before validation. Raw `unknown`-shaped input, so
 * schema tests exercise the same normalisation a real manifest goes through.
 */
export function rawCoaManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    report_id: "ax-2026-4139-wdn9",
    lab_id: "axiom",
    lab_verification_code: "7b6c-f0a5-619d",
    product_id: COA_PRODUCT_ID,
    compound_name: "Tesamorelin",
    lot_number: "tsm-260101-010",
    tested_strength_mg: 20,
    tested_strength_unit: "mg",
    sample_received_on: "2026-10-21",
    issued_on: "2026-10-28",
    purity_percent: 99.9,
    net_content_mg: 21.22,
    results: [
      {
        test: "Purity",
        method: "RP-HPLC, 214 nm",
        specification: "≥ 99.25 area %",
        result: "99.9%",
        outcome: "met",
      },
    ],
    chromatograms: [
      {
        path: "/coa/AX-2026-4139-WDN9/chromatogram-1.webp",
        caption: "HPLC chromatogram",
        alt: "HPLC trace with one dominant peak",
      },
    ],
    scan_path: "/coa/AX-2026-4139-WDN9/report.webp",
    ...overrides,
  };
}

/** A stored report version, as the repository hands it to the mapper. */
export function coaRecord(overrides: Partial<CoaRecord> = {}): CoaRecord {
  return {
    report_id: "AX-2026-4139-WDN9",
    version: 1,
    status: "active",
    lab_id: "axiom",
    product_id: COA_PRODUCT_ID,
    compound_name: "Tesamorelin",
    lot_number: "TSM-260101-010",
    tested_strength_mg: 20,
    tested_strength_unit: "mg",
    issued_on: "2026-10-28",
    purity_percent: 99.9,
    results: [
      {
        test: "Purity",
        method: "RP-HPLC",
        specification: "≥ 99.25 area %",
        result: "99.9%",
        outcome: "met",
      },
    ],
    chromatograms: [],
    scan_path: "/coa/AX-2026-4139-WDN9/report.webp",
    updated_at: "2026-10-28T12:00:00.000Z",
    ...overrides,
  };
}

export function coaSummary(overrides: Partial<CoaReportSummary> = {}): CoaReportSummary {
  return {
    reportId: "AX-2026-4139-WDN9",
    version: 1,
    status: "active",
    supersededBy: null,
    labId: "axiom",
    productId: COA_PRODUCT_ID,
    compoundName: "Tesamorelin",
    lotNumber: "TSM-260101-010",
    testedStrengthMg: 20,
    testedStrengthUnit: "mg",
    issuedOn: "2026-10-28",
    purityPercent: 99.9,
    ...overrides,
  };
}

export function coaReport(overrides: Partial<CoaReport> = {}): CoaReport {
  return {
    ...coaSummary(),
    labVerificationCode: null,
    sampleReceivedOn: null,
    netContentMg: null,
    changeNote: null,
    results: [],
    chromatograms: [],
    scanPath: "/coa/AX-2026-4139-WDN9/report.webp",
    updatedAt: null,
    ...overrides,
  };
}

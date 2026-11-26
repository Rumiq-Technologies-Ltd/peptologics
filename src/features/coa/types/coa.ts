/**
 * The domain shape of a published Certificate of Analysis, as the rest of the application
 * sees it. Not the storage item: `coa.mappers.ts` is the one boundary between the two.
 */

/** `active` is shown as current. `withdrawn` and `superseded` stay visible, with a banner. */
export type CoaStatus = "active" | "withdrawn" | "superseded";

/** What the lab reported against its own specification. Never computed by us. */
export type CoaOutcome = "met" | "not_met" | "not_applicable";

/** The laboratories whose reports we publish. Registered in `constants/labs.ts`. */
export type CoaLabId = "axiom" | "bioviridian";

export type CoaStrengthUnit = "mg" | "ml";

/** One row of the lab's results table, transcribed from the report. */
export interface CoaResultRow {
  test: string;
  method: string;
  specification: string;
  result: string;
  outcome: CoaOutcome;
}

export interface CoaChromatogram {
  /** A path under `/coa/<report id>/`. */
  path: string;
  caption: string;
  /** Required: the image is evidence, so it needs a text equivalent. */
  alt: string;
}

/** What a list needs. Leaves out the results and images so a listing stays small. */
export interface CoaReportSummary {
  /** The laboratory's own report ID, normalised. This is what a customer types. */
  reportId: string;
  version: number;
  status: CoaStatus;
  /** Set only when `status` is `superseded`. */
  supersededBy: string | null;
  labId: CoaLabId;
  productId: string;
  compoundName: string;
  lotNumber: string;
  /** What the lab actually tested, which can differ from the product's current vial size. */
  testedStrengthMg: number;
  testedStrengthUnit: CoaStrengthUnit;
  /** ISO date (`yyyy-mm-dd`). */
  issuedOn: string;
  /** The lab's measured purity, entered from its report. Null when the report has none. */
  purityPercent: number | null;
}

/** The full record shown on the report's own page. */
export interface CoaReport extends CoaReportSummary {
  labVerificationCode: string | null;
  sampleReceivedOn: string | null;
  netContentMg: number | null;
  /** Why this version exists. Required from version 2 and for any non-active status. */
  changeNote: string | null;
  results: CoaResultRow[];
  chromatograms: CoaChromatogram[];
  /** The lab's original report, as published. */
  scanPath: string | null;
  updatedAt: string | null;
}

/** One line of a report's public revision history. */
export interface CoaVersionEntry {
  version: number;
  status: CoaStatus;
  changeNote: string | null;
  issuedOn: string | null;
  updatedAt: string | null;
}

/** What a product page shows for a product: its report, and whether it is for another lot size. */
export interface CoaProductDisplay {
  report: CoaReportSummary;
  /** True when the tested strength differs from the product's current vial size (D19). */
  isPreviousStrengthLot: boolean;
}

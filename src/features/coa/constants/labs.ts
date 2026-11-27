/**
 * The laboratories whose reports we publish, and how a customer checks one with the lab.
 *
 * Code rather than a database table: there are two labs, and the link that tells a customer
 * where to verify a certificate is reviewed like any other code change.
 *
 * Nothing here, or anywhere in the COA copy, may claim an accreditation. Neither laboratory is
 * ISO/IEC 17025 accredited, and a test fails the build if the words appear.
 */

export type CoaLabId = "axiom" | "bioviridian";

export interface CoaLab {
  id: CoaLabId;
  /** The name as the lab prints it on its reports. */
  name: string;
  /** Short form for buttons. */
  shortName: string;
  /** The lab's own public verification page. The authority for every report it issued. */
  verifyPageUrl: string;
  /**
   * Where "Verify with lab" sends the customer for one report. Axiom has a stable link per
   * report; Bioviridian has none, so it sends the customer to its search page.
   */
  verifyUrl: (reportId: string) => string;
  /** Shown with the report: why the lab's own record is the one to trust. */
  warning: string;
}

/** The one line shown beside every code, for either lab. */
export const COA_LOOKUP_INSTRUCTION =
  "Paste this code on the lab's verification page to confirm this report.";

export const COA_LABS: Record<CoaLabId, CoaLab> = {
  axiom: {
    id: "axiom",
    name: "Axiom Analytics Labs LLC",
    shortName: "Axiom",
    verifyPageUrl: "https://axiomanalyticslab.com/verify",
    verifyUrl: (reportId) =>
      `https://axiomanalyticslab.com/verify?coa=${encodeURIComponent(reportId)}`,
    warning:
      "Always confirm a certificate with the laboratory that issued it. The laboratory's own record is the authority, not a copy on any other site.",
  },
  bioviridian: {
    id: "bioviridian",
    name: "Bioviridian",
    shortName: "Bioviridian",
    verifyPageUrl: "https://bioviridians.com/coa-search.html",
    verifyUrl: () => "https://bioviridians.com/coa-search.html",
    warning:
      "Bioviridian has warned that fraudulent certificates using its name are in circulation. Confirm this report with the laboratory itself before relying on any copy.",
  },
};

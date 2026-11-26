import type { CoaLabId } from "@/features/coa/types/coa";

/**
 * The laboratories whose reports we publish.
 *
 * Code rather than a database table: there are two labs, and a link that tells a customer
 * where to verify a certificate is reviewed like any other code change.
 *
 * Nothing here, or anywhere in the COA copy, may claim an accreditation. Neither
 * laboratory is ISO/IEC 17025 accredited, and a test fails the build if the words appear.
 */
export interface CoaLab {
  id: CoaLabId;
  /** The legal or trading name as the lab prints it on its reports. */
  name: string;
  /** The lab's own public verification page. The authority for every report it issued. */
  verifyPageUrl: string;
  /**
   * A link straight to one report on the lab's site, if the lab has a stable per-report URL.
   * Left out until proven with a real report ID: a guessed URL is worse than none.
   */
  reportUrl?: (reportId: string) => string;
  /** How to look a report up, in the lab's own terms. */
  lookupInstruction: (reportId: string) => string;
  /** Shown beside the verify link on every record page. */
  warning: string;
}

export const COA_LABS: Record<CoaLabId, CoaLab> = {
  axiom: {
    id: "axiom",
    name: "Axiom Analytics Labs LLC",
    verifyPageUrl: "https://axiomanalyticslab.com/verify",
    // `reportUrl` deliberately absent: the per-report URL pattern is unconfirmed. Open the
    // verify page with a real report ID, read the resulting address, then add it here.
    lookupInstruction: (reportId) =>
      `Enter report ID ${reportId} on the laboratory's verification page.`,
    warning:
      "Always confirm a certificate with the laboratory that issued it. The laboratory's own record is the authority, not a copy on any other site.",
  },
  bioviridian: {
    id: "bioviridian",
    name: "Bioviridian",
    verifyPageUrl: "https://bioviridians.com/coa-search.html",
    lookupInstruction: (reportId) => `Enter code ${reportId} in the laboratory's COA search.`,
    warning:
      "Bioviridian has warned that fraudulent certificates using its name are in circulation. Confirm this report with the laboratory itself before relying on any copy.",
  },
};

export function isCoaLabId(value: string): value is CoaLabId {
  return Object.hasOwn(COA_LABS, value);
}

export function getCoaLab(id: CoaLabId): CoaLab {
  return COA_LABS[id];
}

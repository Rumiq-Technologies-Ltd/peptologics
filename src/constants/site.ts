/**
 * Company and site-wide constants. Single source for anything that appears in
 * more than one place — metadata, structured data, the footer, email templates.
 */

export const SITE_NAME = "PeptoLogics" as const;
export const SITE_DOMAIN = "peptologics.com" as const;
export const SITE_TAGLINE = "Premium Peptides · Pure Results" as const;

export const SITE_DESCRIPTION =
  "PeptoLogics supplies lyophilized research peptides with a Certificate of Analysis for every lot. Compare list pricing and cost per milligram, then request a quotation. For laboratory research use only." as const;

/**
 * The compliance line shown in the strip at the top of every page and repeated
 * in the footer. Kept in one constant so it can never drift between surfaces.
 */
export const COMPLIANCE_NOTICE =
  "For laboratory research use only · Not for human or animal consumption" as const;

export const COMPLIANCE_NOTICE_LONG =
  "All products are supplied for laboratory research use only. Not for human or animal consumption. Not evaluated by the FDA for therapeutic use." as const;

/** How long an accepted Research-Use-Only acknowledgement is remembered. */
export const RUO_ACKNOWLEDGEMENT_DAYS = 30 as const;

/** localStorage key for the gate. Versioned so the schema can change safely. */
export const RUO_STORAGE_KEY = "pl_ruo_ack" as const;
export const RUO_STORAGE_VERSION = 1 as const;

/** Minimum age affirmed in the disclaimer gate. */
export const MINIMUM_AGE = 21 as const;

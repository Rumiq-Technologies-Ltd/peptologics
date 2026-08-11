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
 * The compliance line. Kept in one constant so it can never drift between surfaces.
 *
 * No longer in the top strip — that space now carries the shipping promotion below.
 * It still appears in the page metadata and on both generated Open Graph images, and
 * the footer carries `COMPLIANCE_NOTICE_LONG` on every page, so the research-use-only
 * disclosure remains site-wide.
 */
export const COMPLIANCE_NOTICE =
  "For laboratory research use only · Not for human or animal consumption" as const;

/**
 * The promotional line in the strip above the header.
 *
 * Separate from the compliance notice on purpose: this one is marketing copy that
 * will change whenever the offer does, and the compliance notice must not be edited
 * by accident while doing it.
 *
 * TODO(client): the $250 threshold and "ground shipping" must match what Shipping &
 * payment actually promises. A banner on every page is a representation to the buyer.
 */
export const SHIPPING_PROMOTION = "Free Ground Shipping on Orders Over $250" as const;

export const COMPLIANCE_NOTICE_LONG =
  "All products are supplied for laboratory research use only. Not for human or animal consumption. Not evaluated by the FDA for therapeutic use." as const;

/** How long an accepted Research-Use-Only acknowledgement is remembered. */
export const RUO_ACKNOWLEDGEMENT_DAYS = 30 as const;

/** localStorage key for the gate. Versioned so the schema can change safely. */
export const RUO_STORAGE_KEY = "pl_ruo_ack" as const;
export const RUO_STORAGE_VERSION = 1 as const;

/** Minimum age affirmed in the disclaimer gate. */
export const MINIMUM_AGE = 21 as const;

/**
 * localStorage key for the persisted inquiry list, and its schema version.
 *
 * Versioned separately from the gate so either can change without invalidating
 * the other. The version is what `persist`'s `migrate` compares against: a record
 * written by an older schema is discarded rather than guessed at, because the
 * only thing stored is product IDs and quantities — cheap to rebuild, dangerous
 * to misread.
 */
export const CART_STORAGE_KEY = "pl_inquiry_list" as const;
export const CART_STORAGE_VERSION = 1 as const;

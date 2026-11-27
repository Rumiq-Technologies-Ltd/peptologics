import type { CoaLabId } from "@/features/coa/constants/labs";

/**
 * Every published Certificate of Analysis, in one place. This file is the **single source of
 * truth**: the database no longer says which products have a COA (`products.coa_url` is
 * unused), so the two can never drift apart.
 *
 * Keyed by the **product slug**. An entry has one of two shapes:
 *
 * - **Hosted**: one current report with a `file` in `public/coa/` (an image scan or a PDF).
 *   It may also carry a `previous` report with its own file.
 * - **Link-only**: one or more current reports with no `file`. No scan, image or PDF of the
 *   report is shown or stored here; the customer is sent to the lab's own record.
 *
 * Every ID is read from the laboratory's own report. A product with no entry shows no COA.
 *
 * To add one: put the file (if any) in `public/coa/`, then add an entry here.
 */
export interface CoaVerification {
  labId: CoaLabId;
  /** Exactly as the laboratory prints it. */
  reportId: string;
}

export interface CoaReport {
  /** Which lab issued it and the code to look it up by. Null for a report we cannot verify. */
  verification: CoaVerification | null;
  /** The lot, as the lab prints it. */
  lot?: string;
  /** Measured purity as the lab states it, for example "99.88%". */
  purity?: string;
  /** Path under `public/`. Absent on a link-only report. */
  file?: string;
}

export interface PreviousCoaReport extends CoaReport {
  /** Button text. Defaults to "Previous certificate". */
  label?: string;
}

export interface CoaEntry {
  current: readonly CoaReport[];
  previous?: PreviousCoaReport;
}

export const DEFAULT_PREVIOUS_LABEL = "Previous certificate";

const bio = (reportId: string): CoaVerification => ({ labId: "bioviridian", reportId });
const axiom = (reportId: string): CoaVerification => ({ labId: "axiom", reportId });

export const COA_ENTRIES: Readonly<Record<string, CoaEntry>> = {
  // Axiom reports hosted as PDFs (D20).
  "mots-c-10mg": {
    current: [
      {
        verification: axiom("AX-2026-1759-FVQU"),
        lot: "MOTSC10-260101-010",
        purity: "99.51%",
        file: "/coa/AX-2026-1759-FVQU.pdf",
      },
    ],
  },
  "ipamorelin-10mg": {
    current: [
      {
        verification: axiom("AX-2026-3736-HDRU"),
        lot: "IPA10-260201-010",
        purity: "99.88%",
        file: "/coa/AX-2026-3736-HDRU.pdf",
      },
    ],
    previous: { verification: bio("COA9409"), file: "/coa/ipamorelin-10mg.webp" },
  },
  "tesamorelin-20mg": {
    current: [
      {
        verification: axiom("AX-2026-4139-WDN9"),
        lot: "TSM-260101-010",
        purity: "99.9%",
        file: "/coa/AX-2026-4139-WDN9.pdf",
      },
    ],
    previous: {
      verification: bio("COA9403"),
      lot: "Tesa10-260101-054",
      file: "/coa/tesamorelin-10mg.webp",
      label: "Previous certificate · 10 mg lot",
    },
  },
  "cjc-ipa-10mg": {
    current: [
      {
        verification: axiom("AX-2026-4213-BER3"),
        lot: "CJC/IPA10-260101-022",
        // The lab reports each component; this is their mean.
        purity: "99.78% (mean of the two components)",
        file: "/coa/AX-2026-4213-BER3.pdf",
      },
    ],
  },

  // Link-only (D22, D25): the lab's record, never a copy of the report.
  "pl3-10mg": {
    current: [
      { verification: axiom("AX-2026-3211-9CTJ"), lot: "PLRT310-260101-035", purity: "99.93%" },
    ],
  },
  "pl3-30mg": {
    current: [
      { verification: axiom("AX-2026-4286-S5HS"), lot: "PLRT310-260101-010", purity: "99.53%" },
      { verification: bio("COA9401"), lot: "PLRT3-260101-060", purity: "99.76%" },
    ],
  },
  "pl2-30mg": {
    current: [{ verification: bio("COA9402"), lot: "PLTZ2-260101-052", purity: "99.73%" }],
  },

  // Hosted Bioviridian scans.
  "bpc-157-10mg": { current: [{ verification: bio("COA9405"), file: "/coa/bpc-157-10mg.webp" }] },
  "mots-c-40mg": { current: [{ verification: bio("COA9404"), file: "/coa/mots-c-40mg.webp" }] },
  "ghk-cu-100mg": { current: [{ verification: bio("COA9406"), file: "/coa/ghk-cu-100mg.webp" }] },
  "kpv-10mg": { current: [{ verification: bio("COA9407"), file: "/coa/kpv-10mg.webp" }] },
  "wolverine-20mg": {
    current: [{ verification: bio("COA9408"), file: "/coa/wolverine-20mg.webp" }],
  },

  // Reports issued to other companies. They stay as they are today, pending the owner's
  // decision (D27), and have nothing of ours to verify, so no lab and no button.
  "ss-31-10mg": { current: [{ verification: null, file: "/coa/ss-31-10mg.jpg" }] },
  "nad-plus-500mg": { current: [{ verification: null, file: "/coa/nad-plus-500mg.jpg" }] },
};

/** The entry for a product, or null if it publishes no COA. */
export function getCoaEntry(slug: string): CoaEntry | null {
  if (!Object.hasOwn(COA_ENTRIES, slug)) return null;

  return COA_ENTRIES[slug] ?? null;
}

export function isPdf(file: string): boolean {
  return file.toLowerCase().endsWith(".pdf");
}

/** A link-only entry has no hosted file on any current report. */
export function isLinkOnly(entry: CoaEntry): boolean {
  return entry.current.every((report) => !report.file);
}

/**
 * The "Previous certificate" report, or null.
 *
 * Shown only when every file is hosted on this site (so link-only products never get it,
 * even with reports from two labs) and the product has COAs from both testing labs.
 */
export function getPreviousReport(entry: CoaEntry): PreviousCoaReport | null {
  const { previous } = entry;
  if (!previous?.file || entry.current.some((report) => !report.file)) return null;

  const labs = new Set<CoaLabId | undefined>(
    [...entry.current, previous].map((report) => report.verification?.labId),
  );

  return labs.has("axiom") && labs.has("bioviridian") ? previous : null;
}

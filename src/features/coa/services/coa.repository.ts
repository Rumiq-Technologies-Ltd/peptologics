import "server-only";

import type { CoaReport, CoaReportSummary, CoaVersionEntry } from "@/features/coa/types/coa";

/**
 * Database access for published COA reports. Fetch only: no business decisions.
 *
 * Reads only. Publishing is done by the publish script (`scripts/coa.ts`), never by a
 * request to the site, so the public application holds no way to write a certificate.
 */
export interface CoaRepository {
  /** The current (highest) version of one report, or null if there is none. */
  findCurrent(reportId: string): Promise<CoaReport | null>;
  /** Every version of one report, newest first. */
  listVersions(reportId: string): Promise<CoaVersionEntry[]>;
  /** The current version of every report, newest issue date first. Summaries only. */
  listCurrent(): Promise<CoaReportSummary[]>;
}

/**
 * The repository while the data store is still Supabase (ADR-035). COA records exist only in
 * DynamoDB, so until the switch there is nothing to read and every lookup is a clean miss.
 * That keeps the COA code inert, like the other DynamoDB code, rather than failing a page.
 */
export function createEmptyCoaRepository(): CoaRepository {
  return {
    findCurrent: async () => null,
    listVersions: async () => [],
    listCurrent: async () => [],
  };
}

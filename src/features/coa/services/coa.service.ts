import "server-only";

import { MESSAGES } from "@/constants/messages";
import type { CoaRepository } from "@/features/coa/services/coa.repository";
import type {
  CoaProductDisplay,
  CoaReport,
  CoaReportSummary,
  CoaStrengthUnit,
  CoaVersionEntry,
} from "@/features/coa/types/coa";
import { buildProductDisplay } from "@/features/coa/utils/coaRules";
import { normalizeReportId } from "@/features/coa/utils/normalizeReportId";
import { logger } from "@/lib/logger";
import { fail, ok, type ServiceResult } from "@/types/result";

/**
 * Business rules for published COA reports.
 *
 * Decides what a lookup means and what a product page shows; the repository only fetches.
 * Knows nothing about React or HTTP.
 */

/** A report together with its public revision history, which a record page shows as one unit. */
export interface CoaRecordView {
  report: CoaReport;
  /** Newest first. Always includes the current version. */
  history: CoaVersionEntry[];
}

export interface CoaService {
  /**
   * Looks a report up by whatever a visitor typed. `NOT_FOUND` covers both a malformed ID and
   * an unknown one: from outside, they are the same answer.
   */
  getRecord(rawReportId: string): Promise<ServiceResult<CoaRecordView>>;
  /** True when a report exists (in any status). Used by the verify form to redirect. */
  verify(rawReportId: string): Promise<ServiceResult<{ reportId: string }>>;
  /** Every current report, newest first, for the library. */
  listCurrent(): Promise<ServiceResult<CoaReportSummary[]>>;
  /**
   * What a product page shows for a product, or null. Never throws and never fails: a COA
   * outage must not take a product page down, so any problem reads as "no certificate".
   */
  getProductDisplay(product: {
    id: string;
    strengthMg: number;
    strengthUnit: CoaStrengthUnit;
  }): Promise<CoaProductDisplay | null>;
}

export interface CoaServiceDeps {
  repository: CoaRepository;
}

export function createCoaService({ repository }: CoaServiceDeps): CoaService {
  return {
    async getRecord(rawReportId) {
      const reportId = normalizeReportId(rawReportId);
      if (!reportId) return fail("NOT_FOUND", MESSAGES.coa.notFound);

      try {
        const [report, history] = await Promise.all([
          repository.findCurrent(reportId),
          repository.listVersions(reportId),
        ]);

        if (!report) return fail("NOT_FOUND", MESSAGES.coa.notFound);

        return ok({ report, history });
      } catch (error) {
        logger.error("coa_record_failed", { error, reportId });
        return fail("UNEXPECTED", MESSAGES.coa.loadFailed);
      }
    },

    async verify(rawReportId) {
      const reportId = normalizeReportId(rawReportId);
      if (!reportId) return fail("NOT_FOUND", MESSAGES.coa.notFound);

      try {
        const report = await repository.findCurrent(reportId);
        return report ? ok({ reportId }) : fail("NOT_FOUND", MESSAGES.coa.notFound);
      } catch (error) {
        logger.error("coa_verify_failed", { error, reportId });
        return fail("UNEXPECTED", MESSAGES.coa.loadFailed);
      }
    },

    async listCurrent() {
      try {
        return ok(await repository.listCurrent());
      } catch (error) {
        logger.error("coa_list_failed", { error });
        return fail("UNEXPECTED", MESSAGES.coa.loadFailed);
      }
    },

    async getProductDisplay(product) {
      try {
        return buildProductDisplay(await repository.listCurrent(), product);
      } catch (error) {
        logger.error("coa_product_display_failed", { error, productId: product.id });
        return null;
      }
    },
  };
}

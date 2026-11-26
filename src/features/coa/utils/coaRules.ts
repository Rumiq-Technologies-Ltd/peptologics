import { MINIMUM_PURITY_PERCENT, PURITY_RULE_CATEGORIES } from "@/constants/business";
import type {
  CoaProductDisplay,
  CoaReportSummary,
  CoaStatus,
  CoaStrengthUnit,
} from "@/features/coa/types/coa";

/** Whether the company purity rule (D18) applies to a catalog category. */
export function appliesPurityRule(category: string): boolean {
  return PURITY_RULE_CATEGORIES.includes(category);
}

/**
 * Problems that must stop a report being published, as plain sentences for the person
 * running the publish script. An empty list means the report may go out.
 *
 * Only an `active` report is held to the rule. Withdrawing or superseding a report must
 * always be possible, including one that fell short.
 */
export function checkPurityRule(input: {
  category: string;
  status: CoaStatus;
  purityPercent: number | null;
}): string[] {
  if (input.status !== "active" || !appliesPurityRule(input.category)) return [];

  if (input.purityPercent === null) {
    return [
      `A ${input.category} report needs the lab's measured purity; it is the evidence for the ${MINIMUM_PURITY_PERCENT}% rule.`,
    ];
  }

  if (input.purityPercent < MINIMUM_PURITY_PERCENT) {
    return [
      `Measured purity ${input.purityPercent}% is below the ${MINIMUM_PURITY_PERCENT}% rule for ${input.category} products. Do not publish; raise it with the owner.`,
    ];
  }

  return [];
}

/**
 * The report a product page shows: the newest `active` one for that product.
 * Withdrawn and superseded reports never appear on a product page, only on their own record.
 */
export function selectReportForProduct(
  reports: readonly CoaReportSummary[],
  productId: string,
): CoaReportSummary | null {
  const candidates = reports.filter(
    (report) => report.productId === productId && report.status === "active",
  );

  // Newest issue date first; the report ID breaks a tie so the choice is deterministic.
  candidates.sort(
    (a, b) => b.issuedOn.localeCompare(a.issuedOn) || b.reportId.localeCompare(a.reportId),
  );

  return candidates[0] ?? null;
}

/**
 * True when the report tested a different vial size than the product is sold at now, for
 * example the 500 mg NAD+ report kept on the 1000 mg product page (D19). Computed from the
 * numbers, so the label can never drift from them.
 */
export function isPreviousStrengthLot(
  report: Pick<CoaReportSummary, "testedStrengthMg" | "testedStrengthUnit">,
  product: { strengthMg: number; strengthUnit: CoaStrengthUnit },
): boolean {
  return (
    report.testedStrengthMg !== product.strengthMg ||
    report.testedStrengthUnit !== product.strengthUnit
  );
}

export function buildProductDisplay(
  reports: readonly CoaReportSummary[],
  product: { id: string; strengthMg: number; strengthUnit: CoaStrengthUnit },
): CoaProductDisplay | null {
  const report = selectReportForProduct(reports, product.id);
  if (!report) return null;

  return { report, isPreviousStrengthLot: isPreviousStrengthLot(report, product) };
}

import { describe, expect, it } from "vitest";

import {
  appliesPurityRule,
  buildProductDisplay,
  checkPurityRule,
  isPreviousStrengthLot,
  selectReportForProduct,
} from "@/features/coa/utils/coaRules";
import { COA_PRODUCT_ID, coaSummary } from "@/test/coaFactories";

describe("purity rule (D18)", () => {
  it("covers peptides only", () => {
    expect(appliesPurityRule("peptide")).toBe(true);
    for (const category of ["blend", "cosmetic", "supply"]) {
      expect(appliesPurityRule(category)).toBe(false);
    }
  });

  it("allows a peptide at or above 99%", () => {
    expect(checkPurityRule({ category: "peptide", status: "active", purityPercent: 99 })).toEqual(
      [],
    );
    expect(
      checkPurityRule({ category: "peptide", status: "active", purityPercent: 99.78 }),
    ).toEqual([]);
  });

  it("blocks an active peptide report below 99%", () => {
    const problems = checkPurityRule({
      category: "peptide",
      status: "active",
      purityPercent: 98.99,
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/below the 99% rule/);
  });

  it("requires a measured purity on an active peptide report", () => {
    expect(
      checkPurityRule({ category: "peptide", status: "active", purityPercent: null }),
    ).toHaveLength(1);
  });

  it("never blocks a withdrawn or superseded report, so withdrawal is always possible", () => {
    for (const status of ["withdrawn", "superseded"] as const) {
      expect(checkPurityRule({ category: "peptide", status, purityPercent: 90 })).toEqual([]);
    }
  });

  it("does not hold supplies, blends or cosmetics to the rule", () => {
    for (const category of ["blend", "cosmetic", "supply"]) {
      expect(checkPurityRule({ category, status: "active", purityPercent: 50 })).toEqual([]);
      expect(checkPurityRule({ category, status: "active", purityPercent: null })).toEqual([]);
    }
  });
});

describe("selectReportForProduct", () => {
  it("picks the newest active report for the product", () => {
    const reports = [
      coaSummary({ reportId: "OLD-1", issuedOn: "2026-09-01" }),
      coaSummary({ reportId: "NEW-1", issuedOn: "2026-11-01" }),
    ];

    expect(selectReportForProduct(reports, COA_PRODUCT_ID)?.reportId).toBe("NEW-1");
  });

  it("ignores withdrawn and superseded reports and other products", () => {
    const reports = [
      coaSummary({ reportId: "W-1", status: "withdrawn", issuedOn: "2026-11-20" }),
      coaSummary({ reportId: "S-1", status: "superseded", issuedOn: "2026-11-19" }),
      coaSummary({ reportId: "OTHER-1", productId: "someone-else", issuedOn: "2026-11-18" }),
    ];

    expect(selectReportForProduct(reports, COA_PRODUCT_ID)).toBeNull();
  });

  it("breaks an issue-date tie by report ID, deterministically", () => {
    const reports = [
      coaSummary({ reportId: "AAA-1", issuedOn: "2026-11-01" }),
      coaSummary({ reportId: "BBB-1", issuedOn: "2026-11-01" }),
    ];

    expect(selectReportForProduct(reports, COA_PRODUCT_ID)?.reportId).toBe("BBB-1");
    expect(selectReportForProduct([...reports].reverse(), COA_PRODUCT_ID)?.reportId).toBe("BBB-1");
  });
});

describe("previous-strength lot (D19)", () => {
  const product = { id: COA_PRODUCT_ID, strengthMg: 1000, strengthUnit: "mg" as const };

  it("flags a 500 mg report shown on the 1000 mg product", () => {
    expect(isPreviousStrengthLot(coaSummary({ testedStrengthMg: 500 }), product)).toBe(true);
  });

  it("does not flag a matching strength", () => {
    expect(isPreviousStrengthLot(coaSummary({ testedStrengthMg: 1000 }), product)).toBe(false);
  });

  it("treats a different unit as a different strength", () => {
    expect(
      isPreviousStrengthLot(
        coaSummary({ testedStrengthMg: 1000, testedStrengthUnit: "ml" }),
        product,
      ),
    ).toBe(true);
  });

  it("builds the product display with the flag", () => {
    const display = buildProductDisplay([coaSummary({ testedStrengthMg: 500 })], product);

    expect(display?.isPreviousStrengthLot).toBe(true);
    expect(buildProductDisplay([], product)).toBeNull();
  });
});

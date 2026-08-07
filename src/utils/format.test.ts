import { describe, expect, it } from "vitest";

import { formatCostPerMg, formatCurrency, formatCurrencyExact } from "@/utils/formatCurrency";
import { formatStrength, formatStrengthCompact, formatVialLabel } from "@/utils/formatStrength";
import { isValidSlug, slugify } from "@/utils/slugify";

/**
 * Display formatting.
 *
 * Small functions, but every price a customer sees passes through them, and the
 * integer-cents decision (ADR-002) only pays off if the division happens exactly once,
 * here, at the display boundary.
 */

describe("formatCurrency", () => {
  it("drops the decimals on a whole amount, which is the whole catalog", () => {
    expect(formatCurrency(6000)).toBe("$60");
    expect(formatCurrency(0)).toBe("$0");
  });

  it("keeps the cents when there are any", () => {
    expect(formatCurrency(6050)).toBe("$60.50");
    expect(formatCurrency(1)).toBe("$0.01");
  });

  it("groups thousands", () => {
    expect(formatCurrency(594_000)).toBe("$5,940");
  });
});

describe("formatCurrencyExact", () => {
  it("always shows two decimals, so a column of subtotals stays aligned", () => {
    expect(formatCurrencyExact(6000)).toBe("$60.00");
    expect(formatCurrencyExact(604_000)).toBe("$6,040.00");
  });
});

describe("formatCostPerMg", () => {
  it("renders two decimals with the unit", () => {
    expect(formatCostPerMg(6)).toBe("$6.00/mg");
    expect(formatCostPerMg(0.11)).toBe("$0.11/mg");
  });

  it("rounds to two places, matching the source price list", () => {
    // K-L-O-W's true value is 0.9375/mg. Displaying $0.94 is intended (ADR-003).
    expect(formatCostPerMg(0.9375)).toBe("$0.94/mg");
  });
});

describe("formatStrength", () => {
  it("drops meaningless trailing zeros", () => {
    expect(formatStrength(10)).toBe("10 mg");
    expect(formatStrength(0.5)).toBe("0.5 mg");
  });

  it("has a compact form for dense table columns", () => {
    expect(formatStrengthCompact(500)).toBe("500mg");
  });

  it("builds the catalog's vial label", () => {
    expect(formatVialLabel(10)).toBe("10mg/vial · single vial");
  });
});

describe("slugify and isValidSlug", () => {
  it("produces a URL-safe slug", () => {
    expect(slugify("BPC-157 10mg")).toBe("bpc-157-10mg");
    expect(slugify("  NAD+  500 mg  ")).toBe("nad-500-mg");
  });

  it("accepts a well-formed slug", () => {
    expect(isValidSlug("retatrutide-10mg")).toBe(true);
  });

  it.each([
    ["a traversal attempt", "../../etc/passwd"],
    ["an uppercase slug", "Retatrutide"],
    ["spaces", "reta trutide"],
    ["an empty string", ""],
  ])("rejects %s", (_label, candidate) => {
    // Slugs are authored, so anything off-pattern cannot exist and is refused before a
    // query is spent on it.
    expect(isValidSlug(candidate)).toBe(false);
  });
});

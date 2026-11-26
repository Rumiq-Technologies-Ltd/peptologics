import { describe, expect, it } from "vitest";

import { normalizeReportId } from "@/features/coa/utils/normalizeReportId";

describe("normalizeReportId", () => {
  it("upper-cases, trims and removes inner whitespace", () => {
    expect(normalizeReportId("  coa 9405 ")).toBe("COA9405");
    expect(normalizeReportId("ax-2026-4139-wdn9")).toBe("AX-2026-4139-WDN9");
  });

  it("accepts both labs' real formats", () => {
    expect(normalizeReportId("AX-2026-00041")).toBe("AX-2026-00041");
    expect(normalizeReportId("COA9405")).toBe("COA9405");
  });

  it.each([
    ["empty", ""],
    ["too short", "AB"],
    ["leading hyphen", "-ABC123"],
    ["a slash", "AX/2026"],
    ["a dot-dot path", "../etc"],
    ["a query string", "COA9405?x=1"],
    ["markup", "<script>"],
    ["a space-separated injection", "COA9405 OR 1=1"],
  ])("rejects %s", (_label, input) => {
    expect(normalizeReportId(input)).toBeNull();
  });

  it("rejects an over-long value without normalising it", () => {
    expect(normalizeReportId("A".repeat(101))).toBeNull();
    expect(normalizeReportId("A".repeat(41))).toBeNull();
  });
});

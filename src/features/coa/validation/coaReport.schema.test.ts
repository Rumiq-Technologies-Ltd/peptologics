import { describe, expect, it } from "vitest";

import { coaReportContentSchema } from "@/features/coa/validation/coaReport.schema";
import { rawCoaManifest } from "@/test/coaFactories";

function parse(overrides: Record<string, unknown> = {}) {
  return coaReportContentSchema.safeParse(rawCoaManifest(overrides));
}

function messages(overrides: Record<string, unknown>): string[] {
  const result = parse(overrides);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("coaReportContentSchema", () => {
  it("accepts a complete manifest and normalises the ID, lot and verification code", () => {
    const result = parse();

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.report_id).toBe("AX-2026-4139-WDN9");
    expect(result.data.lot_number).toBe("TSM-260101-010");
    expect(result.data.lab_verification_code).toBe("7B6C-F0A5-619D");
    expect(result.data.status).toBe("active");
  });

  it("defaults chromatograms to an empty list", () => {
    const result = parse({ chromatograms: undefined });

    expect(result.success && result.data.chromatograms).toEqual([]);
  });

  it("rejects an unregistered laboratory", () => {
    expect(messages({ lab_id: "acme" })).toContain("Not a registered laboratory.");
  });

  it("rejects a malformed report ID", () => {
    expect(messages({ report_id: "AX/2026" })[0]).toMatch(/Not a valid report ID/);
  });

  describe("file paths", () => {
    it("requires the scan to sit in the report's own folder", () => {
      expect(messages({ scan_path: "/coa/OTHER-ID/report.webp" })[0]).toMatch(/Must be \/coa\//);
    });

    it.each([
      ["a path traversal", "/coa/AX-2026-4139-WDN9/../../secret.webp"],
      ["an off-site URL", "https://evil.example/report.webp"],
      ["a protocol-relative URL", "//evil.example/report.webp"],
      ["a wrong extension", "/coa/AX-2026-4139-WDN9/report.svg"],
      ["an upper-case filename", "/coa/AX-2026-4139-WDN9/REPORT.webp"],
    ])("rejects %s", (_label, scanPath) => {
      expect(parse({ scan_path: scanPath }).success).toBe(false);
    });

    it("requires chromatograms to be in the report's folder and to carry alt text", () => {
      expect(
        parse({ chromatograms: [{ path: "/coa/ELSEWHERE/x.webp", caption: "c", alt: "a" }] })
          .success,
      ).toBe(false);
      expect(
        parse({
          chromatograms: [{ path: "/coa/AX-2026-4139-WDN9/x.webp", caption: "c", alt: "" }],
        }).success,
      ).toBe(false);
    });
  });

  describe("dates", () => {
    it("rejects an invalid date", () => {
      expect(parse({ issued_on: "28/10/2026" }).success).toBe(false);
    });

    it("rejects a report issued before the sample was received", () => {
      expect(messages({ sample_received_on: "2026-11-01", issued_on: "2026-10-28" })).toContain(
        "A report cannot be issued before the sample was received.",
      );
    });
  });

  describe("figures", () => {
    it.each([
      ["purity above 100", { purity_percent: 100.5 }],
      ["negative purity", { purity_percent: -1 }],
      ["zero strength", { tested_strength_mg: 0 }],
      ["a string purity", { purity_percent: "99.9" }],
    ])("rejects %s", (_label, overrides) => {
      expect(parse(overrides).success).toBe(false);
    });

    it("rejects an empty results table", () => {
      expect(parse({ results: [] }).success).toBe(false);
    });

    it("rejects an unknown outcome", () => {
      const row = { test: "t", method: "m", specification: "s", result: "r", outcome: "pass!" };
      expect(parse({ results: [row] }).success).toBe(false);
    });
  });

  it("rejects control characters in text", () => {
    expect(parse({ compound_name: "Tesa\u0000morelin" }).success).toBe(false);
  });

  describe("status rules", () => {
    it("requires a replacement for a superseded report", () => {
      expect(messages({ status: "superseded", change_note: "Replaced." })).toContain(
        "A superseded report must name the report that replaces it.",
      );
    });

    it("accepts a superseded report that names its replacement, normalised", () => {
      const result = parse({
        status: "superseded",
        superseded_by: "ax-2026-5000",
        change_note: "x",
      });

      expect(result.success && result.data.superseded_by).toBe("AX-2026-5000");
    });

    it("refuses a replacement on a report that is not superseded", () => {
      expect(messages({ superseded_by: "AX-2026-5000" })).toContain(
        "Only a superseded report names a replacement.",
      );
    });

    it("refuses a report that supersedes itself", () => {
      expect(
        messages({
          status: "superseded",
          superseded_by: "AX-2026-4139-WDN9",
          change_note: "x",
        }),
      ).toContain("A report cannot supersede itself.");
    });

    it("requires a public reason for any non-active status", () => {
      expect(messages({ status: "withdrawn" })).toContain(
        "Say why the report is not active; this is shown publicly.",
      );
      expect(parse({ status: "withdrawn", change_note: "Issued in error." }).success).toBe(true);
    });
  });
});

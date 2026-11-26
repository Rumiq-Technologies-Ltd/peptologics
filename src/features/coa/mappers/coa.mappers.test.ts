import { describe, expect, it } from "vitest";

import {
  toCoaReport,
  toCoaReportSummary,
  toCoaVersionEntry,
  toCoaVersionSource,
} from "@/features/coa/mappers/coa.mappers";
import { coaReportContentSchema } from "@/features/coa/validation/coaReport.schema";
import { buildCoaVersionItem, COA_CURRENT_PARTITION } from "@/lib/dynamodb/entities";
import { coaRecord, rawCoaManifest } from "@/test/coaFactories";

describe("toCoaReport", () => {
  it("maps a stored version to the domain shape", () => {
    const report = toCoaReport(coaRecord({ lab_verification_code: "7B6C-F0A5-619D" }));

    expect(report).toMatchObject({
      reportId: "AX-2026-4139-WDN9",
      version: 1,
      status: "active",
      supersededBy: null,
      labId: "axiom",
      lotNumber: "TSM-260101-010",
      testedStrengthMg: 20,
      issuedOn: "2026-10-28",
      purityPercent: 99.9,
      labVerificationCode: "7B6C-F0A5-619D",
      scanPath: "/coa/AX-2026-4139-WDN9/report.webp",
    });
    expect(report?.results).toHaveLength(1);
  });

  it("reads absent attributes as null", () => {
    const report = toCoaReport(coaRecord({ purity_percent: undefined }));

    expect(report?.purityPercent).toBeNull();
    expect(report?.netContentMg).toBeNull();
    expect(report?.changeNote).toBeNull();
  });

  describe("degrades toward less claim, never more", () => {
    it("reads an unknown status as withdrawn, not active", () => {
      expect(toCoaReport(coaRecord({ status: "published" }))?.status).toBe("withdrawn");
      expect(toCoaReport(coaRecord({ status: undefined }))?.status).toBe("withdrawn");
    });

    it("reads an unknown outcome as not applicable, not met", () => {
      const report = toCoaReport(
        coaRecord({
          results: [{ test: "t", method: "m", specification: "s", result: "r", outcome: "ok" }],
        }),
      );

      expect(report?.results[0]?.outcome).toBe("not_applicable");
    });

    it("drops a record naming a laboratory we do not know", () => {
      expect(toCoaReport(coaRecord({ lab_id: "acme" }))).toBeNull();
    });

    it("drops a record missing something a page cannot do without", () => {
      expect(toCoaReport(coaRecord({ lot_number: undefined }))).toBeNull();
      expect(toCoaReport(coaRecord({ report_id: undefined }))).toBeNull();
      expect(toCoaReport(coaRecord({ tested_strength_mg: undefined }))).toBeNull();
    });

    it("refuses an off-site scan or chromatogram path", () => {
      const report = toCoaReport(
        coaRecord({
          scan_path: "javascript:alert(1)",
          chromatograms: [
            { path: "https://evil.example/x.png", caption: "c", alt: "a" },
            { path: "//evil.example/x.png", caption: "c", alt: "a" },
            { path: "/coa/AX-2026-4139-WDN9/ok.webp", caption: "c", alt: "a" },
          ],
        }),
      );

      expect(report?.scanPath).toBeNull();
      // Only the on-site image survives: an https URL is refused too, since a certificate
      // file is always one of ours.
      expect(report?.chromatograms.map((image) => image.path)).toEqual([
        "/coa/AX-2026-4139-WDN9/ok.webp",
      ]);
    });
  });
});

describe("toCoaReportSummary and toCoaVersionEntry", () => {
  it("leaves the heavy fields off a summary", () => {
    const summary = toCoaReportSummary(coaRecord());

    expect(summary).not.toHaveProperty("results");
    expect(summary).not.toHaveProperty("scanPath");
  });

  it("maps a version entry for the revision history", () => {
    expect(toCoaVersionEntry(coaRecord({ version: 2, change_note: "Corrected lot." }))).toEqual({
      version: 2,
      status: "active",
      changeNote: "Corrected lot.",
      issuedOn: "2026-10-28",
      updatedAt: "2026-10-28T12:00:00.000Z",
    });
    expect(toCoaVersionEntry(coaRecord({ version: undefined }))).toBeNull();
  });
});

describe("manifest to stored item to domain", () => {
  const NOW = "2026-11-26T10:00:00.000Z";

  function publish(version: number, current: boolean) {
    const content = coaReportContentSchema.parse(rawCoaManifest());
    return buildCoaVersionItem(toCoaVersionSource(content, version), { current, now: NOW });
  }

  it("round-trips through storage without losing or inventing a value", () => {
    const report = toCoaReport(publish(1, true) as never);

    expect(report).toMatchObject({
      reportId: "AX-2026-4139-WDN9",
      labId: "axiom",
      lotNumber: "TSM-260101-010",
      purityPercent: 99.9,
      netContentMg: 21.22,
      sampleReceivedOn: "2026-10-21",
      status: "active",
      updatedAt: NOW,
    });
    expect(report?.chromatograms).toHaveLength(1);
  });

  it("gives only the current version the sparse index keys", () => {
    expect(publish(2, true)).toMatchObject({
      PK: "COA#AX-2026-4139-WDN9",
      SK: "V#0002",
      GSI1PK: COA_CURRENT_PARTITION,
      GSI1SK: "2026-10-28#AX-2026-4139-WDN9",
    });

    const superseded = publish(1, false);
    expect(superseded).not.toHaveProperty("GSI1PK");
    expect(superseded).not.toHaveProperty("GSI1SK");
  });
});

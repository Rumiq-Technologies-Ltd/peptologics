import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  COA_ENTRIES,
  getCoaEntry,
  getPreviousReport,
  isLinkOnly,
  type CoaReport,
} from "@/features/coa/constants/coaReports";
import { COA_LABS } from "@/features/coa/constants/labs";

const PUBLIC_DIRECTORY = path.resolve(import.meta.dirname, "../../../../public");

const allReports = Object.entries(COA_ENTRIES).flatMap(([slug, entry]) =>
  [...entry.current, ...(entry.previous ? [entry.previous] : [])].map(
    (report): [string, CoaReport] => [slug, report],
  ),
);

describe("COA entries", () => {
  it("points every hosted report at a file that exists", () => {
    for (const [slug, report] of allReports) {
      if (report.file)
        expect(existsSync(path.join(PUBLIC_DIRECTORY, report.file)), slug).toBe(true);
    }
  });

  it("names a registered laboratory and a plausible ID for every verifiable report", () => {
    for (const [slug, report] of allReports) {
      if (!report.verification) continue;
      expect(Object.keys(COA_LABS), slug).toContain(report.verification.labId);
      expect(report.verification.reportId, slug).toMatch(/^[A-Z0-9][A-Z0-9-]{2,39}$/);
    }
  });

  it("never repeats a lab report", () => {
    const ids = allReports.flatMap(([, r]) =>
      r.verification ? [`${r.verification.labId}:${r.verification.reportId}`] : [],
    );

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every link-only report a lab and a code, since the lab is all it has", () => {
    for (const [slug, entry] of Object.entries(COA_ENTRIES)) {
      if (!isLinkOnly(entry)) continue;
      for (const report of entry.current) expect(report.verification, slug).not.toBeNull();
    }
  });

  it("resolves entries by slug and ignores unknown or hostile keys", () => {
    expect(getCoaEntry("pl3-30mg")?.current).toHaveLength(2);
    expect(getCoaEntry("nope")).toBeNull();
    expect(getCoaEntry("__proto__")).toBeNull();
    expect(getCoaEntry("toString")).toBeNull();
  });
});

describe("Previous certificate rule", () => {
  it("applies to IPA 10 mg and Tesamorelin 20 mg, which host Axiom and Bioviridian files", () => {
    expect(getPreviousReport(COA_ENTRIES["ipamorelin-10mg"]!)?.verification?.reportId).toBe(
      "COA9409",
    );
    expect(getPreviousReport(COA_ENTRIES["tesamorelin-20mg"]!)?.label).toBe(
      "Previous certificate · 10 mg lot",
    );
  });

  it("never applies to link-only products, even PL3 30 mg with reports from two labs", () => {
    const pl3 = COA_ENTRIES["pl3-30mg"]!;
    expect(new Set(pl3.current.map((r) => r.verification?.labId)).size).toBe(2);
    expect(getPreviousReport(pl3)).toBeNull();

    for (const entry of Object.values(COA_ENTRIES)) {
      if (isLinkOnly(entry)) expect(getPreviousReport(entry)).toBeNull();
    }
  });

  it("never applies unless the previous report is a hosted file from the other lab", () => {
    const hostedBioviridian = {
      verification: { labId: "bioviridian", reportId: "COA9999" },
    } as const;

    expect(
      getPreviousReport({
        current: [{ ...hostedBioviridian, file: "/coa/a.webp" }],
        previous: { ...hostedBioviridian, file: "/coa/b.webp" },
      }),
    ).toBeNull();
    expect(
      getPreviousReport({
        current: [{ ...hostedBioviridian, file: "/coa/a.webp" }],
        previous: { verification: { labId: "axiom", reportId: "AX-1-AAAA" } },
      }),
    ).toBeNull();
    expect(
      getPreviousReport({ current: [{ ...hostedBioviridian, file: "/coa/a.webp" }] }),
    ).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  contentWithStatus,
  findMissingFiles,
  planPublish,
  type PublishInputs,
  type PublishProduct,
  type StoredCoaVersion,
} from "@/features/coa/publish/coaPublishPlan";
import {
  coaReportContentSchema,
  type CoaReportContent,
} from "@/features/coa/validation/coaReport.schema";
import { COA_PRODUCT_ID, rawCoaManifest } from "@/test/coaFactories";

const NOW = "2026-11-26T10:00:00.000Z";

const product: PublishProduct = {
  id: COA_PRODUCT_ID,
  slug: "tesamorelin-20mg",
  name: "Tesamorelin",
  category: "peptide",
  strengthMg: 20,
  strengthUnit: "mg",
};

function content(overrides: Record<string, unknown> = {}): CoaReportContent {
  return coaReportContentSchema.parse(rawCoaManifest(overrides));
}

/** What the table would hand back for a published version of `content()`. */
function stored(overrides: Record<string, unknown> = {}, version = 1): StoredCoaVersion {
  return { ...content(overrides), version, PK: "COA#AX-2026-4139-WDN9", SK: "V#0001" };
}

function inputs(overrides: Partial<PublishInputs> = {}): PublishInputs {
  return {
    content: content(),
    latest: null,
    product,
    replacementExists: null,
    now: NOW,
    ...overrides,
  };
}

describe("planPublish: a first publication", () => {
  it("writes version 1 as the current version, with nothing to unmark", () => {
    const plan = planPublish(inputs());

    expect(plan.kind).toBe("write");
    if (plan.kind !== "write") return;

    expect(plan.version).toBe(1);
    expect(plan.previousKey).toBeNull();
    expect(plan.item).toMatchObject({
      PK: "COA#AX-2026-4139-WDN9",
      SK: "V#0001",
      GSI1PK: "COA_CURRENT",
      created_at: NOW,
    });
  });

  it("blocks a product that does not exist in the table", () => {
    const plan = planPublish(inputs({ product: null }));

    expect(plan).toMatchObject({ kind: "blocked" });
    expect(plan.kind === "blocked" && plan.problems[0]).toMatch(/does not exist/);
  });

  it("blocks a peptide whose measured purity is below 99%", () => {
    const plan = planPublish(inputs({ content: content({ purity_percent: 98.5 }) }));

    expect(plan.kind === "blocked" && plan.problems.join(" ")).toMatch(/below the 99% rule/);
  });

  it("does not hold a supply to the purity rule", () => {
    const plan = planPublish(
      inputs({
        content: content({ purity_percent: undefined }),
        product: { ...product, category: "supply" },
      }),
    );

    expect(plan.kind).toBe("write");
  });

  it("notes, without blocking, a tested strength that differs from the product (D19)", () => {
    const plan = planPublish(inputs({ content: content({ tested_strength_mg: 500 }) }));

    expect(plan.kind).toBe("write");
    expect(plan.kind === "write" && plan.summary.notes.join(" ")).toMatch(/Previous 500 mg lot/);
  });

  it("blocks a superseded report whose replacement is not published", () => {
    const plan = planPublish(
      inputs({
        content: content({ status: "superseded", superseded_by: "AX-2026-5000", change_note: "x" }),
        replacementExists: false,
      }),
    );

    expect(plan.kind === "blocked" && plan.problems.join(" ")).toMatch(/has not been published/);
  });
});

describe("planPublish: an existing report", () => {
  it("does nothing when the manifest matches the latest version, so a re-run is safe", () => {
    const plan = planPublish(inputs({ latest: stored() }));

    expect(plan).toEqual({ kind: "unchanged", reportId: "AX-2026-4139-WDN9", version: 1 });
  });

  it("ignores key order and a missing empty list when comparing", () => {
    const latest = { ...stored(), results: stored().results, chromatograms: undefined };
    const plan = planPublish(inputs({ latest, content: content({ chromatograms: [] }) }));

    expect(plan.kind).toBe("unchanged");
  });

  it("does not treat a changed change_note alone as a change", () => {
    const plan = planPublish(
      inputs({ latest: stored(), content: content({ change_note: "A different reason" }) }),
    );

    expect(plan.kind).toBe("unchanged");
  });

  it("writes the next version and unmarks the previous one when the content changes", () => {
    const plan = planPublish(
      inputs({
        latest: stored({}, 2),
        content: content({
          purity_percent: 99.5,
          change_note: "Corrected purity to the lab figure.",
        }),
      }),
    );

    expect(plan.kind).toBe("write");
    if (plan.kind !== "write") return;

    expect(plan.version).toBe(3);
    expect(plan.previousKey).toEqual({ PK: "COA#AX-2026-4139-WDN9", SK: "V#0002" });
    expect(plan.item).toMatchObject({
      SK: "V#0003",
      change_note: "Corrected purity to the lab figure.",
    });
  });

  it("requires a change_note for an amendment", () => {
    const plan = planPublish(
      inputs({ latest: stored(), content: content({ purity_percent: 99.5 }) }),
    );

    expect(plan.kind === "blocked" && plan.problems.join(" ")).toMatch(/needs a change_note/);
  });

  it.each([
    ["lot number", { lot_number: "OTHER-LOT-1" }, /lot_number cannot change/],
    ["laboratory", { lab_id: "bioviridian" }, /lab_id cannot change/],
  ])("refuses to change the %s of a published report", (_label, overrides, message) => {
    const plan = planPublish(
      inputs({ latest: stored(), content: content({ ...overrides, change_note: "x" }) }),
    );

    expect(plan.kind === "blocked" && plan.problems.join(" ")).toMatch(message);
  });
});

describe("contentWithStatus", () => {
  it("builds a withdrawn version of the latest report, with the reason", () => {
    const result = contentWithStatus(stored(), { status: "withdrawn", reason: "Issued in error." });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.content).toMatchObject({
      status: "withdrawn",
      change_note: "Issued in error.",
      purity_percent: 99.9,
    });

    // And it plans as the next version, even for a report that fell short of the rule.
    const plan = planPublish(inputs({ latest: stored(), content: result.content }));
    expect(plan.kind === "write" && plan.version).toBe(2);
  });

  it("can withdraw a peptide report whose purity was below 99%", () => {
    const latest = stored({ purity_percent: 90 });
    const result = contentWithStatus(latest, { status: "withdrawn", reason: "Below spec." });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(planPublish(inputs({ latest, content: result.content })).kind).toBe("write");
  });

  it("names the replacement on a superseded version", () => {
    const result = contentWithStatus(stored(), {
      status: "superseded",
      reason: "Replaced by the 1000 mg lot report.",
      supersededBy: "ax-2026-5000",
    });

    expect(result.success && result.content.superseded_by).toBe("AX-2026-5000");
  });

  it("refuses a superseded version with no replacement", () => {
    const result = contentWithStatus(stored(), { status: "superseded", reason: "Replaced." });

    expect(result.success).toBe(false);
  });
});

describe("findMissingFiles", () => {
  it("lists every referenced file that is not on disk", () => {
    const missing = findMissingFiles(content(), (sitePath) => sitePath.endsWith("report.webp"));

    expect(missing).toEqual(["/coa/AX-2026-4139-WDN9/chromatogram-1.webp"]);
  });

  it("is empty when everything exists", () => {
    expect(findMissingFiles(content(), () => true)).toEqual([]);
  });
});

describe("canonicalJson", () => {
  it("is independent of key order and drops absent values", () => {
    expect(canonicalJson({ b: 1, a: { d: undefined, c: null, e: 2 } })).toBe(
      canonicalJson({ a: { e: 2 }, b: 1 }),
    );
  });
});

import { describe, expect, it } from "vitest";

import { COA_LABS, COA_LOOKUP_INSTRUCTION } from "@/features/coa/constants/labs";

describe("laboratory registry", () => {
  it("links each lab's own verification page, over https", () => {
    for (const lab of Object.values(COA_LABS)) {
      expect(new URL(lab.verifyPageUrl).protocol).toBe("https:");
    }

    expect(COA_LABS.bioviridian.verifyPageUrl).toBe("https://bioviridians.com/coa-search.html");
    expect(COA_LABS.axiom.verifyPageUrl).toBe("https://axiomanalyticslab.com/verify");
  });

  it("opens the exact Axiom report, with the ID URL-encoded", () => {
    expect(COA_LABS.axiom.verifyUrl("AX-2026-4139-WDN9")).toBe(
      "https://axiomanalyticslab.com/verify?coa=AX-2026-4139-WDN9",
    );
    expect(COA_LABS.axiom.verifyUrl("A B&c=d/#")).toBe(
      "https://axiomanalyticslab.com/verify?coa=A%20B%26c%3Dd%2F%23",
    );
  });

  it("sends Bioviridian customers to its search page, which has no per-report link", () => {
    expect(COA_LABS.bioviridian.verifyUrl("COA9405")).toBe(
      "https://bioviridians.com/coa-search.html",
    );
  });

  it("warns about fraudulent Bioviridian certificates", () => {
    expect(COA_LABS.bioviridian.warning).toMatch(/fraudulent certificates/);
  });

  it("makes no accreditation claim anywhere in the copy", () => {
    // Neither laboratory is ISO/IEC 17025 accredited; the site must never imply otherwise.
    for (const lab of Object.values(COA_LABS)) {
      for (const sentence of [lab.name, lab.warning, COA_LOOKUP_INSTRUCTION]) {
        expect(sentence).not.toMatch(/accredit|ISO[\s/-]*(?:IEC)?[\s/-]*17025|certified lab/i);
      }
    }
  });
});

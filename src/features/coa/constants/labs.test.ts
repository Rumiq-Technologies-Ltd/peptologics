import { describe, expect, it } from "vitest";

import { COA_LABS, isCoaLabId } from "@/features/coa/constants/labs";
import { MESSAGES } from "@/constants/messages";

/** Every sentence a visitor can read about a lab or a certificate, from this feature's copy. */
function allCoaCopy(): string[] {
  const labCopy = Object.values(COA_LABS).flatMap((lab) => [
    lab.name,
    lab.warning,
    lab.lookupInstruction("ID-123"),
  ]);

  return [...labCopy, ...Object.values(MESSAGES.coa)];
}

describe("laboratory registry", () => {
  it("recognises only registered labs", () => {
    expect(isCoaLabId("axiom")).toBe(true);
    expect(isCoaLabId("bioviridian")).toBe(true);
    expect(isCoaLabId("acme")).toBe(false);
    // A prototype key is not a lab.
    expect(isCoaLabId("toString")).toBe(false);
    expect(isCoaLabId("__proto__")).toBe(false);
  });

  it("links each lab's own verification page over https", () => {
    for (const lab of Object.values(COA_LABS)) {
      expect(new URL(lab.verifyPageUrl).protocol).toBe("https:");
    }
  });

  it("tells the visitor which ID to enter", () => {
    expect(COA_LABS.axiom.lookupInstruction("AX-2026-4139-WDN9")).toContain("AX-2026-4139-WDN9");
    expect(COA_LABS.bioviridian.lookupInstruction("COA9405")).toContain("COA9405");
  });

  it("warns about counterfeits on the Bioviridian record", () => {
    expect(COA_LABS.bioviridian.warning).toMatch(/fraudulent certificates/);
  });

  it("makes no accreditation claim anywhere in the copy", () => {
    // Neither laboratory is ISO/IEC 17025 accredited; the site must never imply otherwise.
    for (const sentence of allCoaCopy()) {
      expect(sentence).not.toMatch(/accredit|ISO[\s/-]*(?:IEC)?[\s/-]*17025|certified lab/i);
    }
  });
});

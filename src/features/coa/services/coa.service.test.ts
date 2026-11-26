import { describe, expect, it, vi } from "vitest";

import type { CoaRepository } from "@/features/coa/services/coa.repository";
import { createCoaService } from "@/features/coa/services/coa.service";
import { COA_PRODUCT_ID, coaReport, coaSummary } from "@/test/coaFactories";

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

function repository(overrides: Partial<CoaRepository> = {}): CoaRepository {
  return {
    findCurrent: vi.fn(async () => coaReport()),
    listVersions: vi.fn(async () => [
      {
        version: 1,
        status: "active" as const,
        changeNote: null,
        issuedOn: "2026-10-28",
        updatedAt: null,
      },
    ]),
    listCurrent: vi.fn(async () => [coaSummary()]),
    ...overrides,
  };
}

const product = { id: COA_PRODUCT_ID, strengthMg: 20, strengthUnit: "mg" as const };

describe("getRecord", () => {
  it("normalises what the visitor typed before looking it up", async () => {
    const repo = repository();
    const result = await createCoaService({ repository: repo }).getRecord(" ax-2026-4139-wdn9 ");

    expect(repo.findCurrent).toHaveBeenCalledWith("AX-2026-4139-WDN9");
    expect(result.success && result.data.report.reportId).toBe("AX-2026-4139-WDN9");
    expect(result.success && result.data.history).toHaveLength(1);
  });

  it("answers a malformed ID as not found, without touching the database", async () => {
    const repo = repository();
    const result = await createCoaService({ repository: repo }).getRecord("../etc/passwd");

    expect(result).toMatchObject({ success: false, code: "NOT_FOUND" });
    expect(repo.findCurrent).not.toHaveBeenCalled();
  });

  it("answers an unknown ID as not found", async () => {
    const result = await createCoaService({
      repository: repository({ findCurrent: vi.fn(async () => null) }),
    }).getRecord("COA9999");

    expect(result).toMatchObject({ success: false, code: "NOT_FOUND" });
  });

  it("still returns a withdrawn report, so its page can say so", async () => {
    const result = await createCoaService({
      repository: repository({
        findCurrent: vi.fn(async () => coaReport({ status: "withdrawn" })),
      }),
    }).getRecord("AX-2026-4139-WDN9");

    expect(result.success && result.data.report.status).toBe("withdrawn");
  });

  it("returns a safe failure, with no detail, when the database throws", async () => {
    const result = await createCoaService({
      repository: repository({
        findCurrent: vi.fn(async () => {
          throw new Error('relation "secret_table" does not exist');
        }),
      }),
    }).getRecord("COA9405");

    expect(result).toMatchObject({ success: false, code: "UNEXPECTED" });
    expect(JSON.stringify(result)).not.toContain("secret_table");
  });
});

describe("verify", () => {
  it("returns the canonical ID when the report exists", async () => {
    const result = await createCoaService({ repository: repository() }).verify("coa 9405");

    expect(result).toEqual({ success: true, data: { reportId: "COA9405" } });
  });

  it("is a not-found for an unknown or malformed ID", async () => {
    const service = createCoaService({
      repository: repository({ findCurrent: vi.fn(async () => null) }),
    });

    expect(await service.verify("COA9999")).toMatchObject({ code: "NOT_FOUND" });
    expect(await service.verify("!!")).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("listCurrent", () => {
  it("wraps the listing, and fails safely", async () => {
    expect(await createCoaService({ repository: repository() }).listCurrent()).toMatchObject({
      success: true,
    });

    const failing = createCoaService({
      repository: repository({
        listCurrent: vi.fn(async () => {
          throw new Error("boom");
        }),
      }),
    });

    expect(await failing.listCurrent()).toMatchObject({ success: false, code: "UNEXPECTED" });
  });
});

describe("getProductDisplay", () => {
  it("returns the product's active report", async () => {
    const display = await createCoaService({ repository: repository() }).getProductDisplay(product);

    expect(display?.report.reportId).toBe("AX-2026-4139-WDN9");
    expect(display?.isPreviousStrengthLot).toBe(false);
  });

  it("flags a report for a different vial size (D19)", async () => {
    const display = await createCoaService({
      repository: repository({
        listCurrent: vi.fn(async () => [coaSummary({ testedStrengthMg: 500 })]),
      }),
    }).getProductDisplay({ ...product, strengthMg: 1000 });

    expect(display?.isPreviousStrengthLot).toBe(true);
  });

  it("shows nothing when the product has no active report", async () => {
    const display = await createCoaService({
      repository: repository({
        listCurrent: vi.fn(async () => [coaSummary({ status: "withdrawn" })]),
      }),
    }).getProductDisplay(product);

    expect(display).toBeNull();
  });

  it("never throws: a COA outage reads as no certificate", async () => {
    const display = await createCoaService({
      repository: repository({
        listCurrent: vi.fn(async () => {
          throw new Error("down");
        }),
      }),
    }).getProductDisplay(product);

    expect(display).toBeNull();
  });
});

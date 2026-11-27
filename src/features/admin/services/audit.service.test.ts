import { describe, expect, it, vi } from "vitest";

// The repository reaches DynamoDB (and the env module); only the pure builder is under test.
vi.mock("@/features/admin/services/audit.repository.dynamodb", () => ({ putAuditEntry: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { createAuditEntry } from "@/features/admin/services/audit.service";
import { buildAuditItem, keys } from "@/lib/dynamodb/entities";

const AT = new Date("2026-11-27T10:30:00.000Z");

describe("the audit item", () => {
  it("files an entry under its UTC month, oldest first within it", () => {
    const entry = createAuditEntry(
      { actorEmail: "a@example.com", actorRole: "owner", action: "sign_in", requestId: "r-1" },
      AT,
      "id-1",
    );

    expect(buildAuditItem(entry)).toMatchObject({
      PK: "AUDIT#2026-11",
      SK: "2026-11-27T10:30:00.000Z#id-1",
      entity: "audit",
      actor_email: "a@example.com",
      actor_role: "owner",
      action: "sign_in",
      request_id: "r-1",
    });
  });

  it("holds the staff email and nothing else personal (a null role is simply absent)", () => {
    const entry = createAuditEntry(
      { actorEmail: "a@example.com", actorRole: null, action: "access_denied", requestId: "r" },
      AT,
      "id-2",
    );

    expect(Object.keys(buildAuditItem(entry)).sort()).toEqual(
      ["PK", "SK", "action", "actor_email", "entity", "id", "request_id", "timestamp"].sort(),
    );
  });

  it("records the month from the timestamp, not from the clock", () => {
    expect(keys.audit("2026-12-01T00:00:00.000Z", "x").PK).toBe("AUDIT#2026-12");
  });
});

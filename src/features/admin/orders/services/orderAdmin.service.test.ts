import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/admin/services/audit.repository.dynamodb", () => ({ putAuditEntry: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import {
  OrderWriteConflict,
  type OrderAdminRepository,
  type OrderWriteStep,
} from "@/features/admin/orders/services/orderAdmin.repository";
import { createOrderAdminService } from "@/features/admin/orders/services/orderAdmin.service";
import type { AdminActor } from "@/features/admin/orders/types";
import {
  buildNotificationItem,
  buildOrderItems,
  buildOrderLineItem,
  buildOrderNoteItem,
  type Item,
  type OrderSource,
} from "@/lib/dynamodb/entities";

const ACTOR: AdminActor = { email: "editor@example.com", role: "editor", requestId: "req-1" };
const NOW = new Date("2026-11-28T12:00:00.000Z");
const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

function orderSource(id: string, number: string, over: Partial<OrderSource> = {}): OrderSource {
  return {
    id,
    order_number: number,
    idempotency_key: `key-${id}`,
    customer_name: "Zed Madeup",
    email: "zed@example.test",
    phone: "5550001111",
    address: "9 Fictional Way",
    city: "Nowhere",
    state: "TX",
    zip_code: "00000",
    country: "US",
    notes: "Please call after noon",
    subtotal_cents: 10000,
    currency: "USD",
    item_count: 1,
    status: "new",
    discount_cents: 0,
    total_cents: 10000,
    created_at: "2026-11-20T10:00:00.000Z",
    updated_at: "2026-11-20T10:00:00.000Z",
    ...over,
  };
}

/** An in-memory table that applies the same conditions and updates DynamoDB would. */
class FakeRepository implements OrderAdminRepository {
  items = new Map<string, Item>();
  commits: OrderWriteStep[][] = [];
  failNextWith: Error | null = null;

  put(item: Item): void {
    this.items.set(`${item.PK}|${item.SK}`, item);
  }

  seedOrder(source: OrderSource): void {
    this.put(buildOrderItems(source)[0] as Item);
  }

  async listMonth(month: string): Promise<Item[]> {
    return [...this.items.values()]
      .filter((item) => item.GSI1PK === `ORDERS#${month}`)
      .sort((a, b) => String(b.GSI1SK).localeCompare(String(a.GSI1SK)));
  }

  async listOpenNotifications(): Promise<Item[]> {
    return [...this.items.values()].filter((item) => item.GSI3PK === "NOTIF_OPEN");
  }

  async findOrderByNumber(orderNumber: string): Promise<Item | null> {
    return (
      [...this.items.values()].find((item) => item.GSI2PK === `ORDERNO#${orderNumber}`) ?? null
    );
  }

  async getOrderItem(orderId: string): Promise<Item | null> {
    return this.items.get(`ORDER#${orderId}|META`) ?? null;
  }

  async getOrderPartition(orderId: string): Promise<Item[]> {
    return [...this.items.values()]
      .filter((item) => item.PK === `ORDER#${orderId}`)
      .sort((a, b) => String(a.SK).localeCompare(String(b.SK)));
  }

  async countNewInMonth(month: string): Promise<number> {
    return (await this.listMonth(month)).filter(
      (item) => item.status === "new" && item.deleted_at === undefined,
    ).length;
  }

  async commit(steps: readonly OrderWriteStep[]): Promise<void> {
    if (this.failNextWith) {
      const error = this.failNextWith;
      this.failNextWith = null;
      throw error;
    }

    for (const step of steps) {
      const key = step.kind === "put" ? step.item : step.key;
      const existing = this.items.get(`${key.PK}|${key.SK}`);
      const expression = step.condition?.expression;
      const values = step.condition?.values ?? {};
      let allowed = true;

      if (expression === "attribute_not_exists(PK)") allowed = !existing;
      else if (expression === "attribute_exists(PK)") allowed = Boolean(existing);
      else if (expression === "#v = :v") allowed = existing?.version === values[":v"];
      else if (expression === "attribute_not_exists(#v)") allowed = existing?.version === undefined;

      if (!allowed) throw new OrderWriteConflict(step.onConflict ?? "version");
    }

    this.commits.push([...steps]);

    for (const step of steps) {
      if (step.kind === "put") this.put(step.item);
      if (step.kind === "update") this.applyUpdate(step);
    }
  }

  private applyUpdate(step: Extract<OrderWriteStep, { kind: "update" }>): void {
    const id = `${step.key.PK}|${step.key.SK}`;
    const next: Item = { ...this.items.get(id) };
    const [setPart, removePart] = step.update.replace(/^SET /, "").split(" REMOVE ");

    for (const assignment of (setPart ?? "").split(", ")) {
      const [name, value] = assignment.split(" = ");
      next[step.names?.[name as string] as string] = step.values?.[value as string];
    }
    if (removePart) delete next[step.names?.[removePart] as string];

    this.items.set(id, next);
  }

  audit(): Item[] {
    return [...this.items.values()].filter((item) => item.entity === "audit");
  }
}

function setup() {
  const repository = new FakeRepository();
  repository.seedOrder(orderSource(ID_A, "PL-001001"));
  const service = createOrderAdminService({
    repository,
    now: () => NOW,
    newId: () => "note-id-1",
  });
  return { repository, service };
}

describe("listRecent", () => {
  it("reads each month, newest first, and flags orders with an open notification", async () => {
    const { repository, service } = setup();
    repository.seedOrder(
      orderSource(ID_B, "PL-001002", { created_at: "2026-10-05T08:00:00.000Z" }),
    );
    repository.seedOrder(
      orderSource("33333333-3333-4333-8333-333333333333", "PL-001003", {
        created_at: "2026-11-25T08:00:00.000Z",
      }),
    );
    repository.put(
      buildNotificationItem({
        order_id: ID_A,
        channel: "email",
        status: "failed",
        attempts: 3,
        created_at: "2026-11-20T10:00:01.000Z",
      }),
    );

    const oneMonth = await service.listRecent(1);
    expect(oneMonth.map((o) => o.orderNumber)).toEqual(["PL-001003", "PL-001001"]);
    expect(oneMonth.find((o) => o.orderNumber === "PL-001001")?.emailProblem).toBe(true);
    expect(oneMonth.find((o) => o.orderNumber === "PL-001003")?.emailProblem).toBe(false);

    const twoMonths = await service.listRecent(2);
    expect(twoMonths.map((o) => o.orderNumber)).toEqual(["PL-001003", "PL-001001", "PL-001002"]);
  });

  it("does not flag a skipped notification as a problem", async () => {
    const { repository, service } = setup();
    repository.put(
      buildNotificationItem({
        order_id: ID_A,
        channel: "email",
        status: "skipped",
        attempts: 0,
        created_at: "2026-11-20T10:00:01.000Z",
      }),
    );

    expect((await service.listRecent(1))[0]?.emailProblem).toBe(false);
  });

  it("includes hidden orders: filtering them is the screen's job", async () => {
    const { repository, service } = setup();
    repository.seedOrder(
      orderSource(ID_B, "PL-001002", { deleted_at: "2026-11-21T00:00:00.000Z" }),
    );

    const orders = await service.listRecent(1);
    expect(orders.find((o) => o.orderNumber === "PL-001002")?.deletedAt).not.toBeNull();
  });
});

describe("getDetail", () => {
  it("finds an order by its number and gathers lines, notifications and notes", async () => {
    const { repository, service } = setup();
    repository.put(
      buildOrderLineItem({
        order_id: ID_A,
        product_id: "p1",
        product_name: "BPC-157",
        product_slug: "bpc-157-10mg",
        strength_mg: 10,
        quantity: 2,
        unit_price_cents: 5000,
        subtotal_cents: 10000,
        created_at: "2026-11-20T10:00:00.000Z",
      }),
    );
    repository.put(
      buildNotificationItem({
        order_id: ID_A,
        channel: "email",
        status: "sent",
        attempts: 1,
        sent_at: "2026-11-20T10:00:05.000Z",
        created_at: "2026-11-20T10:00:01.000Z",
      }),
    );
    for (const [id, at] of [
      ["n2", "2026-11-22T00:00:00.000Z"],
      ["n1", "2026-11-21T00:00:00.000Z"],
    ] as const) {
      repository.put(
        buildOrderNoteItem({
          id,
          order_id: ID_A,
          body: `note ${id}`,
          author_email: "owner@example.com",
          author_role: "owner",
          created_at: at,
        }),
      );
    }

    const detail = await service.getDetail("PL-001001");

    expect(detail?.order.version).toBe(0);
    expect(detail?.lines).toHaveLength(1);
    expect(detail?.notifications[0]?.status).toBe("sent");
    expect(detail?.notes.map((n) => n.id)).toEqual(["n1", "n2"]);
  });

  it("leaves out the provider's error text", async () => {
    const { repository, service } = setup();
    repository.put(
      buildNotificationItem({
        order_id: ID_A,
        channel: "email",
        status: "failed",
        attempts: 3,
        error_message: "boom: secret provider detail",
        created_at: "2026-11-20T10:00:01.000Z",
      }),
    );

    const detail = await service.getDetail("PL-001001");

    expect(JSON.stringify(detail)).not.toContain("secret provider detail");
    expect(detail?.order.emailProblem).toBe(true);
  });

  it("returns null for an unknown number", async () => {
    expect(await setup().service.getDetail("PL-009999")).toBeNull();
  });
});

describe("countNew", () => {
  it("counts new, visible orders over the last twelve months", async () => {
    const { repository, service } = setup();
    repository.seedOrder(orderSource(ID_B, "PL-001002", { status: "contacted" }));
    repository.seedOrder(
      orderSource("33333333-3333-4333-8333-333333333333", "PL-001003", {
        deleted_at: "2026-11-21T00:00:00.000Z",
      }),
    );
    repository.seedOrder(
      orderSource("44444444-4444-4444-8444-444444444444", "PL-001004", {
        created_at: "2026-01-05T08:00:00.000Z",
      }),
    );

    expect(await service.countNew()).toBe(2);
  });
});

describe("changeStatus", () => {
  it("moves to any status, bumps the version and writes one audit item in the same transaction", async () => {
    const { repository, service } = setup();

    const result = await service.changeStatus(ID_A, "completed", 0, ACTOR);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.order.status).toBe("completed");
    expect(result.data.order.version).toBe(1);
    expect(repository.commits).toHaveLength(1);
    expect(repository.commits[0]).toHaveLength(2);

    const stored = await repository.getOrderItem(ID_A);
    expect(stored).toMatchObject({
      status: "completed",
      version: 1,
      updated_at: NOW.toISOString(),
    });

    expect(repository.audit()[0]).toMatchObject({
      action: "order_status_changed",
      target: "PL-001001",
      changes: { status: { from: "new", to: "completed" } },
    });
  });

  it("allows going back to an earlier status", async () => {
    const { service } = setup();
    await service.changeStatus(ID_A, "completed", 0, ACTOR);
    const back = await service.changeStatus(ID_A, "new", 1, ACTOR);

    expect(back.success && back.data.order.status).toBe("new");
  });

  it("refuses a stale version without writing", async () => {
    const { repository, service } = setup();
    await service.changeStatus(ID_A, "contacted", 0, ACTOR);

    const stale = await service.changeStatus(ID_A, "confirmed", 0, ACTOR);

    expect(stale).toMatchObject({ success: false, code: "VERSION_CONFLICT" });
    expect(repository.commits).toHaveLength(1);
  });

  it("turns a lost race inside the transaction into the same conflict", async () => {
    const { repository, service } = setup();
    repository.failNextWith = new OrderWriteConflict("version");

    const result = await service.changeStatus(ID_A, "contacted", 0, ACTOR);

    expect(result).toMatchObject({
      success: false,
      code: "VERSION_CONFLICT",
      message: "This order changed since you opened it. Reload.",
    });
  });

  it("changes nothing and logs nothing when the status is already that", async () => {
    const { repository, service } = setup();

    const result = await service.changeStatus(ID_A, "new", 0, ACTOR);

    expect(result.success && result.data.changed).toBe(false);
    expect(repository.commits).toHaveLength(0);
  });

  it("rejects an unknown status and an unknown order", async () => {
    const { service } = setup();

    expect(await service.changeStatus(ID_A, "shipped", 0, ACTOR)).toMatchObject({
      success: false,
      code: "VALIDATION_FAILED",
    });
    expect(await service.changeStatus(ID_B, "new", 0, ACTOR)).toMatchObject({
      success: false,
      code: "NOT_FOUND",
    });
  });

  it("never edits what the customer asked for", async () => {
    const { repository, service } = setup();
    const before = { ...(await repository.getOrderItem(ID_A)) };

    await service.changeStatus(ID_A, "confirmed", 0, ACTOR);
    const after = (await repository.getOrderItem(ID_A)) as Item;

    for (const field of [
      "customer_name",
      "email",
      "phone",
      "address",
      "notes",
      "total_cents",
      "subtotal_cents",
      "discount_cents",
    ]) {
      expect(after[field]).toBe(before[field]);
    }
  });
});

describe("hide and restore", () => {
  it("hides as test or spam with deleted_at, never deleting the order", async () => {
    const { repository, service } = setup();

    const hidden = await service.hide(ID_A, 0, ACTOR);

    expect(hidden.success && hidden.data.order.deletedAt).toBe(NOW.toISOString());
    expect(await repository.getOrderItem(ID_A)).toMatchObject({
      deleted_at: NOW.toISOString(),
      version: 1,
    });
    expect(repository.audit()[0]).toMatchObject({
      action: "order_hidden",
      changes: { hidden: { from: false, to: true } },
    });
  });

  it("restores by removing deleted_at", async () => {
    const { repository, service } = setup();
    await service.hide(ID_A, 0, ACTOR);

    const restored = await service.restore(ID_A, 1, ACTOR);

    expect(restored.success && restored.data.order.deletedAt).toBeNull();
    const stored = (await repository.getOrderItem(ID_A)) as Item;
    expect(stored).not.toHaveProperty("deleted_at");
    expect(stored.version).toBe(2);
    expect(repository.audit().map((a) => a.action)).toEqual(["order_hidden", "order_restored"]);
  });

  it("does nothing when hiding a hidden order or restoring a visible one", async () => {
    const { repository, service } = setup();

    const restore = await service.restore(ID_A, 0, ACTOR);
    expect(restore.success && restore.data.changed).toBe(false);

    await service.hide(ID_A, 0, ACTOR);
    const again = await service.hide(ID_A, 1, ACTOR);
    expect(again.success && again.data.changed).toBe(false);
    expect(repository.commits).toHaveLength(1);
  });

  it("refuses a stale version", async () => {
    const { service } = setup();
    await service.changeStatus(ID_A, "contacted", 0, ACTOR);

    expect(await service.hide(ID_A, 0, ACTOR)).toMatchObject({
      success: false,
      code: "VERSION_CONFLICT",
    });
  });
});

describe("addNote", () => {
  it("stores a sanitised note with its author and time, and audits only its id", async () => {
    const { repository, service } = setup();

    const result = await service.addNote(ID_A, "  Called​ the customer.  ", ACTOR);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      id: "note-id-1",
      body: "Called the customer.",
      authorEmail: "editor@example.com",
      authorRole: "editor",
      createdAt: NOW.toISOString(),
    });
    expect(repository.items.has(`ORDER#${ID_A}|NOTE#${NOW.toISOString()}#note-id-1`)).toBe(true);

    const [audit] = repository.audit();
    expect(audit).toMatchObject({
      action: "order_note_added",
      target: "PL-001001",
      changes: { noteId: { from: null, to: "note-id-1" } },
    });
    expect(JSON.stringify(audit)).not.toContain("Called");
  });

  it("does not change the order itself", async () => {
    const { repository, service } = setup();
    await service.addNote(ID_A, "hello", ACTOR);

    expect(await repository.getOrderItem(ID_A)).not.toHaveProperty("version");
  });

  it("rejects an empty or over-long note, and a missing order", async () => {
    const { repository, service } = setup();

    expect(await service.addNote(ID_A, "   ", ACTOR)).toMatchObject({
      success: false,
      code: "VALIDATION_FAILED",
    });
    expect(await service.addNote(ID_A, "x".repeat(2001), ACTOR)).toMatchObject({
      success: false,
      code: "VALIDATION_FAILED",
    });
    expect(await service.addNote(ID_B, "hello", ACTOR)).toMatchObject({
      success: false,
      code: "NOT_FOUND",
    });
    expect(repository.commits).toHaveLength(0);
  });
});

describe("audit privacy (D41)", () => {
  it("holds the order number and changed fields, never customer data", async () => {
    const { repository, service } = setup();

    await service.changeStatus(ID_A, "contacted", 0, ACTOR);
    await service.hide(ID_A, 1, ACTOR);
    await service.restore(ID_A, 2, ACTOR);
    await service.addNote(ID_A, "Spoke to Zed Madeup at 5550001111", ACTOR);

    const audits = repository.audit();
    expect(audits).toHaveLength(4);

    const serialised = JSON.stringify(audits);
    for (const secret of [
      "Zed",
      "Madeup",
      "zed@example.test",
      "5550001111",
      "Fictional Way",
      "Please call after noon",
    ]) {
      expect(serialised).not.toContain(secret);
    }
    for (const audit of audits) expect(audit.target).toBe("PL-001001");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  orders: { changeStatus: vi.fn(), hide: vi.fn(), restore: vi.fn(), addNote: vi.fn() },
}));

vi.mock("@/lib/admin/authorize.server", () => ({
  requireAdmin: mocks.requireAdmin,
  requestId: async () => "req-1",
}));
vi.mock("@/features/admin/orders/services/container.server", () => ({
  getOrderAdmin: () => mocks.orders,
}));

import {
  addOrderNoteAction,
  changeOrderStatusAction,
  hideOrderAction,
  restoreOrderAction,
} from "@/features/admin/orders/actions/orderActions";
import type { AdminOrder } from "@/features/admin/orders/types";

const ID = "11111111-1111-4111-8111-111111111111";
const ORDER = { id: ID, orderNumber: "PL-001001", version: 1 } as AdminOrder;
const ACTOR = { email: "editor@example.com", role: "editor", requestId: "req-1" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ email: ACTOR.email, role: ACTOR.role });
});

describe("access", () => {
  it("every action asks for an editor and a same-origin request", async () => {
    mocks.orders.changeStatus.mockResolvedValue({
      success: true,
      data: { order: ORDER, changed: true },
    });
    mocks.orders.hide.mockResolvedValue({ success: true, data: { order: ORDER, changed: true } });
    mocks.orders.restore.mockResolvedValue({
      success: true,
      data: { order: ORDER, changed: true },
    });
    mocks.orders.addNote.mockResolvedValue({ success: true, data: { id: "n" } });

    await changeOrderStatusAction(ID, 0, "contacted");
    await hideOrderAction(ID, 0);
    await restoreOrderAction(ID, 0);
    await addOrderNoteAction(ID, "hi");

    expect(mocks.requireAdmin).toHaveBeenCalledTimes(4);
    for (const call of mocks.requireAdmin.mock.calls) {
      expect(call[0]).toEqual({ role: "editor", mutating: true });
    }
  });

  it("does not reach the service when access is refused", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(changeOrderStatusAction(ID, 0, "new")).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.orders.changeStatus).not.toHaveBeenCalled();
  });
});

describe("changeOrderStatusAction", () => {
  it("passes the actor, version and status to the service", async () => {
    mocks.orders.changeStatus.mockResolvedValue({
      success: true,
      data: { order: ORDER, changed: true },
    });

    const result = await changeOrderStatusAction(ID, 3, "confirmed");

    expect(mocks.orders.changeStatus).toHaveBeenCalledWith(ID, "confirmed", 3, ACTOR);
    expect(result).toMatchObject({ success: true, message: "Status saved." });
  });

  it("says so when nothing changed", async () => {
    mocks.orders.changeStatus.mockResolvedValue({
      success: true,
      data: { order: ORDER, changed: false },
    });

    expect(await changeOrderStatusAction(ID, 0, "new")).toMatchObject({
      success: true,
      message: "Nothing to save: no changes.",
    });
  });

  it("surfaces a version conflict with its code", async () => {
    mocks.orders.changeStatus.mockResolvedValue({
      success: false,
      code: "VERSION_CONFLICT",
      message: "This order changed since you opened it. Reload.",
    });

    expect(await changeOrderStatusAction(ID, 0, "new")).toMatchObject({
      success: false,
      code: "VERSION_CONFLICT",
    });
  });

  it("rejects a malformed id or version before calling the service", async () => {
    expect(await changeOrderStatusAction("nope", 0, "new")).toMatchObject({ success: false });
    expect(await changeOrderStatusAction(ID, -1, "new")).toMatchObject({ success: false });
    expect(await changeOrderStatusAction(ID, 1.5, "new")).toMatchObject({ success: false });
    expect(mocks.orders.changeStatus).not.toHaveBeenCalled();
  });
});

describe("hide, restore and notes", () => {
  it("maps each to its service call and message", async () => {
    mocks.orders.hide.mockResolvedValue({ success: true, data: { order: ORDER, changed: true } });
    mocks.orders.restore.mockResolvedValue({
      success: true,
      data: { order: ORDER, changed: true },
    });

    expect(await hideOrderAction(ID, 1)).toMatchObject({
      message: "Order hidden as test or spam.",
    });
    expect(await restoreOrderAction(ID, 2)).toMatchObject({ message: "Order restored." });
    expect(mocks.orders.hide).toHaveBeenCalledWith(ID, 1, ACTOR);
    expect(mocks.orders.restore).toHaveBeenCalledWith(ID, 2, ACTOR);
  });

  it("returns validation errors for a note the service refuses", async () => {
    mocks.orders.addNote.mockResolvedValue({
      success: false,
      code: "VALIDATION_FAILED",
      message: "Write something before adding the note.",
      fieldErrors: { body: ["Write something before adding the note."] },
    });

    expect(await addOrderNoteAction(ID, "")).toMatchObject({
      success: false,
      code: "VALIDATION_FAILED",
      fieldErrors: { body: ["Write something before adding the note."] },
    });
  });

  it("returns the saved note", async () => {
    mocks.orders.addNote.mockResolvedValue({ success: true, data: { id: "n1", body: "hi" } });

    expect(await addOrderNoteAction(ID, "hi")).toMatchObject({
      success: true,
      message: "Note added.",
      note: { id: "n1" },
    });
  });

  it("rejects a malformed order id", async () => {
    expect(await addOrderNoteAction("nope", "hi")).toMatchObject({ success: false });
    expect(mocks.orders.addNote).not.toHaveBeenCalled();
  });
});

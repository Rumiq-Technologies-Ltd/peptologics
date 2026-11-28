import { randomUUID } from "node:crypto";

import type {
  AdminActor,
  AdminOrderDetail,
  AdminOrderNote,
  AdminOrderSummary,
  OrderChangeOutcome,
  OrderStatus,
} from "@/features/admin/orders/types";
import {
  MAX_MONTHS,
  NEW_ORDER_COUNT_MONTHS,
  recentMonths,
} from "@/features/admin/orders/utils/orderMonths";
import { noteBodySchema, orderStatusSchema } from "@/features/admin/orders/validation/order.schema";
import { createAuditEntry } from "@/features/admin/services/audit.service";
import {
  ORDER_SK,
  buildAuditItem,
  buildOrderNoteItem,
  keys,
  type AuditAction,
  type AuditSource,
  type Item,
} from "@/lib/dynamodb/entities";
import { logger } from "@/lib/logger";
import { fail, ok, type ServiceResult } from "@/types/result";

import {
  toAdminOrder,
  toNotification,
  toOrderLine,
  toOrderNote,
  toOrderSummary,
} from "./orderAdmin.mapper";
import {
  OrderWriteConflict,
  type OrderAdminRepository,
  type OrderWriteStep,
  type StepCondition,
} from "./orderAdmin.repository";

/**
 * Admin order rules (D35, D41): list by month, read, change status, add staff notes, hide as
 * test or spam and restore.
 *
 * What the customer asked for is read-only: nothing here edits lines, prices or contact
 * details. Every change is one transaction holding the change and its audit item, and the audit
 * item carries the order number and the changed fields only, never customer data or note text.
 */

export interface OrderAdminDeps {
  repository: OrderAdminRepository;
  now?: () => Date;
  newId?: () => string;
}

export interface OrderAdminService {
  /** Orders of the current month and the `months - 1` before it, newest first. */
  listRecent(months: number): Promise<AdminOrderSummary[]>;
  /** The order with every child item, or null. Does not write the audit line: the page does. */
  getDetail(orderNumber: string): Promise<AdminOrderDetail | null>;
  /** Orders still `new` and visible, over the last twelve months. */
  countNew(): Promise<number>;
  changeStatus(
    orderId: string,
    target: unknown,
    expectedVersion: number,
    actor: AdminActor,
  ): Promise<ServiceResult<OrderChangeOutcome>>;
  hide(
    orderId: string,
    expectedVersion: number,
    actor: AdminActor,
  ): Promise<ServiceResult<OrderChangeOutcome>>;
  restore(
    orderId: string,
    expectedVersion: number,
    actor: AdminActor,
  ): Promise<ServiceResult<OrderChangeOutcome>>;
  addNote(
    orderId: string,
    body: unknown,
    actor: AdminActor,
  ): Promise<ServiceResult<AdminOrderNote>>;
}

const CONFLICT_MESSAGE = "This order changed since you opened it. Reload.";

/** The condition that makes a write fail if somebody else saved first. */
export function versionCondition(expected: number): StepCondition {
  return expected === 0
    ? { expression: "attribute_not_exists(#v)", names: { "#v": "version" } }
    : { expression: "#v = :v", names: { "#v": "version" }, values: { ":v": expected } };
}

function currentVersion(item: Item): number {
  return typeof item.version === "number" ? item.version : 0;
}

export function createOrderAdminService({
  repository,
  now = () => new Date(),
  newId = randomUUID,
}: OrderAdminDeps): OrderAdminService {
  function auditStep(
    actor: AdminActor,
    action: AuditAction,
    orderNumber: string,
    changes: AuditSource["changes"],
    at: Date,
  ): OrderWriteStep {
    return {
      kind: "put",
      item: buildAuditItem(
        createAuditEntry(
          {
            actorEmail: actor.email,
            actorRole: actor.role,
            action,
            // The order number only: it identifies the order without naming the customer.
            target: orderNumber,
            changes,
            requestId: actor.requestId,
          },
          at,
        ),
      ),
    };
  }

  async function commit(steps: OrderWriteStep[]): Promise<ServiceResult<null>> {
    try {
      await repository.commit(steps);
      return ok(null);
    } catch (error) {
      if (error instanceof OrderWriteConflict) {
        return error.kind === "missing"
          ? fail("NOT_FOUND", "That order no longer exists.")
          : fail("VERSION_CONFLICT", CONFLICT_MESSAGE);
      }
      logger.error("admin_order_write_failed", { error });
      return fail("PERSISTENCE_FAILED", "Unable to save the change. Please try again.");
    }
  }

  /** Loads the order and checks the caller still has the latest copy. */
  async function loadForChange(
    orderId: string,
    expectedVersion: number,
  ): Promise<ServiceResult<Item>> {
    const item = await repository.getOrderItem(orderId);
    if (!item) return fail("NOT_FOUND", "That order no longer exists.");
    if (currentVersion(item) !== expectedVersion) return fail("VERSION_CONFLICT", CONFLICT_MESSAGE);
    return ok(item);
  }

  /** Applies a single change to the order item and its version, with its audit line. */
  async function changeOrder(options: {
    orderId: string;
    expectedVersion: number;
    actor: AdminActor;
    action: AuditAction;
    changes: (item: Item) => AuditSource["changes"];
    set: Record<string, unknown>;
    remove?: string;
    isNoOp: (item: Item) => boolean;
  }): Promise<ServiceResult<OrderChangeOutcome>> {
    const loaded = await loadForChange(options.orderId, options.expectedVersion);
    if (!loaded.success) return loaded;

    const item = loaded.data;
    const unchanged = options.isNoOp(item);
    if (unchanged) return ok({ order: toAdminOrder(item, false), changed: false });

    const at = now();
    const stamp = at.toISOString();
    const nextVersion = options.expectedVersion + 1;
    const setEntries = Object.entries({ ...options.set, updated_at: stamp });

    const names: Record<string, string> = { "#v": "version" };
    const values: Record<string, unknown> = { ":next": nextVersion };
    const assignments = ["#v = :next"];

    setEntries.forEach(([field, value], index) => {
      names[`#f${index}`] = field;
      values[`:f${index}`] = value;
      assignments.push(`#f${index} = :f${index}`);
    });

    if (options.remove) names["#r"] = options.remove;
    const update = `SET ${assignments.join(", ")}${options.remove ? " REMOVE #r" : ""}`;

    const written = await commit([
      {
        kind: "update",
        key: keys.order(options.orderId),
        update,
        names,
        values,
        condition: versionCondition(options.expectedVersion),
      },
      auditStep(
        options.actor,
        options.action,
        String(item.order_number),
        options.changes(item),
        at,
      ),
    ]);
    if (!written.success) return written;

    const next: Item = { ...item, ...Object.fromEntries(setEntries), version: nextVersion };
    if (options.remove) delete next[options.remove];

    return ok({ order: toAdminOrder(next, false), changed: true });
  }

  return {
    async listRecent(months): Promise<AdminOrderSummary[]> {
      const count = Math.min(Math.max(Math.trunc(months), 1), MAX_MONTHS);

      const [perMonth, open] = await Promise.all([
        Promise.all(recentMonths(now(), count).map((month) => repository.listMonth(month))),
        repository.listOpenNotifications(),
      ]);

      const withProblem = new Set(open.map((item) => String(item.order_id)));

      // Each month comes back newest first and months are visited newest first.
      return perMonth.flat().map((item) => toOrderSummary(item, withProblem.has(String(item.id))));
    },

    async getDetail(orderNumber): Promise<AdminOrderDetail | null> {
      const found = await repository.findOrderByNumber(orderNumber);
      if (!found) return null;

      const items = await repository.getOrderPartition(String(found.id));
      const meta = items.find((item) => item.SK === "META");
      if (!meta) return null;

      const children = (prefix: string) =>
        items.filter((item) => String(item.SK).startsWith(prefix));
      const notifications = children(ORDER_SK.notification).map(toNotification);
      const emailProblem = notifications.some(
        (notification) => notification.status === "pending" || notification.status === "failed",
      );

      return {
        order: toAdminOrder(meta, emailProblem),
        lines: children(ORDER_SK.item).map(toOrderLine),
        notifications,
        // The sort key starts with the timestamp, so the partition already lists oldest first.
        notes: children(ORDER_SK.note).map(toOrderNote),
      };
    },

    async countNew(): Promise<number> {
      const counts = await Promise.all(
        recentMonths(now(), NEW_ORDER_COUNT_MONTHS).map((month) =>
          repository.countNewInMonth(month),
        ),
      );
      return counts.reduce((sum, count) => sum + count, 0);
    },

    async changeStatus(orderId, target, expectedVersion, actor) {
      const parsed = orderStatusSchema.safeParse(target);
      if (!parsed.success) return fail("VALIDATION_FAILED", "Choose one of the listed statuses.");

      const to: OrderStatus = parsed.data;

      return changeOrder({
        orderId,
        expectedVersion,
        actor,
        action: "order_status_changed",
        set: { status: to },
        changes: (item) => ({ status: { from: item.status ?? null, to } }),
        isNoOp: (item) => item.status === to,
      });
    },

    async hide(orderId, expectedVersion, actor) {
      return changeOrder({
        orderId,
        expectedVersion,
        actor,
        action: "order_hidden",
        changes: () => ({ hidden: { from: false, to: true } }),
        set: { deleted_at: now().toISOString() },
        isNoOp: (item) => typeof item.deleted_at === "string",
      });
    },

    async restore(orderId, expectedVersion, actor) {
      return changeOrder({
        orderId,
        expectedVersion,
        actor,
        action: "order_restored",
        changes: () => ({ hidden: { from: true, to: false } }),
        set: {},
        remove: "deleted_at",
        isNoOp: (item) => typeof item.deleted_at !== "string",
      });
    },

    async addNote(orderId, rawBody, actor) {
      const parsed = noteBodySchema.safeParse(rawBody);
      if (!parsed.success) {
        return fail("VALIDATION_FAILED", parsed.error.issues[0]?.message ?? "Check the note.", {
          fieldErrors: { body: parsed.error.issues.map((issue) => issue.message) },
        });
      }

      const item = await repository.getOrderItem(orderId);
      if (!item) return fail("NOT_FOUND", "That order no longer exists.");

      const at = now();
      const id = newId();
      const noteItem = buildOrderNoteItem({
        id,
        order_id: orderId,
        body: parsed.data,
        author_email: actor.email,
        author_role: actor.role,
        created_at: at.toISOString(),
      });

      const written = await commit([
        {
          kind: "check",
          key: keys.order(orderId),
          condition: { expression: "attribute_exists(PK)" },
          onConflict: "missing",
        },
        { kind: "put", item: noteItem, condition: { expression: "attribute_not_exists(PK)" } },
        // The note's id is logged, never its text.
        auditStep(
          actor,
          "order_note_added",
          String(item.order_number),
          { noteId: { from: null, to: id } },
          at,
        ),
      ]);
      if (!written.success) return written;

      return ok(toOrderNote(noteItem));
    },
  };
}

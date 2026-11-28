import type { Item } from "@/lib/dynamodb/entities";

/** What the admin order service needs from storage, with no AWS in sight. */

export type OrderConflictKind = "version" | "missing";

export class OrderWriteConflict extends Error {
  constructor(readonly kind: OrderConflictKind) {
    super(`Order write refused: ${kind}`);
    this.name = "OrderWriteConflict";
  }
}

/** The condition that guards a step. */
export interface StepCondition {
  expression: string;
  names?: Record<string, string>;
  values?: Record<string, unknown>;
}

/** One write of the transaction. Orders change by update, so a concurrent email result is never overwritten. */
export type OrderWriteStep =
  | { kind: "put"; item: Item; condition?: StepCondition; onConflict?: OrderConflictKind }
  | {
      kind: "update";
      key: { PK: string; SK: string };
      update: string;
      names?: Record<string, string>;
      values?: Record<string, unknown>;
      condition?: StepCondition;
      onConflict?: OrderConflictKind;
    }
  | {
      kind: "check";
      key: { PK: string; SK: string };
      condition: StepCondition;
      onConflict?: OrderConflictKind;
    };

/** DynamoDB's own limit on items in one transaction. */
export const MAX_TRANSACTION_ITEMS = 100;

export interface OrderAdminRepository {
  /** Every order filed under one UTC month (`yyyy-mm`), newest first. */
  listMonth(month: string): Promise<Item[]>;
  /** Every notification still pending or failed, across all orders. */
  listOpenNotifications(): Promise<Item[]>;
  /** The order with this number, or null. */
  findOrderByNumber(orderNumber: string): Promise<Item | null>;
  /** The order item alone, or null. */
  getOrderItem(orderId: string): Promise<Item | null>;
  /** Every item in one order's partition: the order, its lines, notifications and notes. */
  getOrderPartition(orderId: string): Promise<Item[]>;
  /** Orders in the month that are `new` and not hidden. */
  countNewInMonth(month: string): Promise<number>;
  commit(steps: readonly OrderWriteStep[]): Promise<void>;
}

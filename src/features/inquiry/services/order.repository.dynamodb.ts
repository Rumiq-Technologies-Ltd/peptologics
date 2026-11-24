import "server-only";

import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { GetCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";

import { findOrderViolations } from "@/features/inquiry/services/order.invariants";
import type { OrderRepository } from "@/features/inquiry/services/order.repository";
import type { CreateInquiryPayload, InquiryReceipt } from "@/features/inquiry/types/inquiry";
import { getDocumentClient, getTableName } from "@/lib/dynamodb/client.server";
import {
  buildNotificationItem,
  buildOrderItems,
  buildOrderLineItem,
  formatOrderNumber,
  keys,
  ORDER_COUNTER_START,
  type Item,
  type OrderSource,
} from "@/lib/dynamodb/entities";
import { toDatabaseError } from "@/lib/dynamodb/errors";
import { DatabaseError } from "@/lib/errors";

/**
 * The inquiry write path on DynamoDB (ADR-035). One call, one transaction.
 *
 * Replaces the `create_inquiry` Postgres function. The order, its lines, both `pending`
 * notifications and the idempotency guard are written by a single `TransactWriteItems`
 * (at most 1 + 1 + 25 + 2 = 29 items, under the 100 limit), so they all land or none do.
 *
 * Flow: read the guard, take the next order number, then write. The counter advances
 * before the transaction, so a failed transaction leaves a gap in order numbers; gaps were
 * already accepted (ADR-004).
 */

const CHANNELS = ["email", "customer_email"] as const;

interface IdempotencyGuard {
  order_id?: unknown;
  order_number?: unknown;
}

function toReceipt(guard: IdempotencyGuard | undefined, created: boolean): InquiryReceipt | null {
  if (!guard) return null;

  if (typeof guard.order_id !== "string" || typeof guard.order_number !== "string") {
    throw new DatabaseError("orders.create", "idempotency guard has no order identity");
  }

  return { orderId: guard.order_id, orderNumber: guard.order_number, created };
}

async function readGuard(idempotencyKey: string): Promise<InquiryReceipt | null> {
  const { Item: guard } = await getDocumentClient().send(
    new GetCommand({
      TableName: getTableName(),
      Key: keys.idempotency(idempotencyKey),
      // A concurrent duplicate must see the winner's committed write.
      ConsistentRead: true,
    }),
  );

  return toReceipt(guard, false);
}

async function nextOrderNumber(): Promise<string> {
  const { Attributes } = await getDocumentClient().send(
    new UpdateCommand({
      TableName: getTableName(),
      Key: keys.orderCounter,
      // Self-initialising: a fresh table's first inquiry is PL-001000.
      UpdateExpression: "SET seq = if_not_exists(seq, :start) + :one",
      ExpressionAttributeValues: { ":start": ORDER_COUNTER_START, ":one": 1 },
      ReturnValues: "UPDATED_NEW",
    }),
  );

  const sequence = Attributes?.seq;

  if (typeof sequence !== "number") {
    throw new DatabaseError("orders.create", "order counter returned no sequence");
  }

  return formatOrderNumber(sequence);
}

function toOrderSource(
  payload: CreateInquiryPayload,
  orderId: string,
  orderNumber: string,
  now: string,
): OrderSource {
  const { customer } = payload;

  return {
    id: orderId,
    order_number: orderNumber,
    idempotency_key: payload.idempotencyKey,
    customer_name: customer.name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    apartment: customer.apartment,
    city: customer.city,
    state: customer.state,
    zip_code: customer.zipCode,
    country: "US",
    notes: customer.notes,
    subtotal_cents: payload.subtotalCents,
    currency: "USD",
    item_count: payload.items.length,
    status: "new",
    coupon_code: payload.couponCode,
    discount_cents: payload.discountCents,
    total_cents: payload.subtotalCents - payload.discountCents,
    ruo_acknowledged_at: payload.ruoAcknowledgedAt,
    created_at: now,
    updated_at: now,
  };
}

/** Every item of the transaction. The guard is first so its failure is reason 0. */
function buildTransactionItems(
  payload: CreateInquiryPayload,
  orderId: string,
  orderNumber: string,
  now: string,
): Item[] {
  const [order, guard] = buildOrderItems(toOrderSource(payload, orderId, orderNumber, now));

  if (!order || !guard) throw new DatabaseError("orders.create", "order items were not built");

  const lines = payload.items.map((item) =>
    buildOrderLineItem({
      order_id: orderId,
      product_id: item.productId,
      product_name: item.productName,
      product_slug: item.productSlug,
      strength_mg: item.strengthMg,
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents,
      subtotal_cents: item.subtotalCents,
      created_at: now,
    }),
  );

  const notifications = CHANNELS.map((channel) =>
    buildNotificationItem({
      order_id: orderId,
      channel,
      status: "pending",
      attempts: 0,
      created_at: now,
    }),
  );

  return [guard, order, ...lines, ...notifications];
}

/** True when the idempotency guard (transaction item 0) is why the transaction was refused. */
function lostToConcurrentDuplicate(error: unknown): boolean {
  return (
    error instanceof TransactionCanceledException &&
    error.CancellationReasons?.[0]?.Code === "ConditionalCheckFailed"
  );
}

export function createDynamoOrderRepository(): OrderRepository {
  return {
    async create(payload): Promise<InquiryReceipt> {
      const violations = findOrderViolations(payload);

      if (violations.length > 0) {
        throw new DatabaseError(
          "orders.create",
          `order invariants violated: ${violations.join(", ")}`,
        );
      }

      try {
        const replay = await readGuard(payload.idempotencyKey);
        if (replay) return replay;

        const orderId = randomUUID();
        const orderNumber = await nextOrderNumber();
        const now = new Date().toISOString();
        const tableName = getTableName();

        const items = buildTransactionItems(payload, orderId, orderNumber, now);

        try {
          await getDocumentClient().send(
            new TransactWriteCommand({
              TransactItems: items.map((item) => ({
                Put: {
                  TableName: tableName,
                  Item: item,
                  ConditionExpression: "attribute_not_exists(PK)",
                },
              })),
            }),
          );
        } catch (error) {
          if (!lostToConcurrentDuplicate(error)) throw error;

          // A concurrent submission with the same key committed first: return its order.
          const winner = await readGuard(payload.idempotencyKey);
          if (winner) return winner;
          throw error;
        }

        return { orderId, orderNumber, created: true };
      } catch (error) {
        throw toDatabaseError("orders.create", error);
      }
    },
  };
}

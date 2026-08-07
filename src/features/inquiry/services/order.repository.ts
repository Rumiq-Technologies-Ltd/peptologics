import "server-only";

import type { CreateInquiryPayload, InquiryReceipt } from "@/features/inquiry/types/inquiry";
import { DatabaseError } from "@/lib/errors";
import { getWriteClient } from "@/lib/supabase/client.server";
import type { Json } from "@/types/database.types";

/**
 * Database access for the inquiry write path. One call, one transaction.
 *
 * The Supabase client cannot express a multi-statement transaction over PostgREST,
 * so the order, its items and both `notification_log` rows are written by the
 * `create_inquiry` Postgres function instead (ADR-004). This repository's only job
 * is to shape the payload and hand it over — it makes no business decisions and
 * calculates nothing.
 *
 * Uses the service-role client, which bypasses RLS. `orders` and `order_items` have
 * RLS enabled with no policies at all, so no key that could ever reach a browser
 * can read customer PII.
 */

export interface OrderRepository {
  /** Creates an inquiry, or returns the original if the key has been seen. */
  create(payload: CreateInquiryPayload): Promise<InquiryReceipt>;
}

/**
 * Snake_cases the payload for the RPC, which reads raw JSON keys.
 *
 * Typed as `Json` rather than `Record<string, unknown>` so the compiler checks that
 * every value really is serialisable — an accidental `undefined` in place of a `null`
 * would otherwise reach Postgres as a missing key and violate a NOT NULL.
 */
function toRpcPayload(payload: CreateInquiryPayload): Json {
  return {
    idempotency_key: payload.idempotencyKey,
    subtotal_cents: payload.subtotalCents,
    ruo_acknowledged_at: payload.ruoAcknowledgedAt ?? null,
    customer: {
      name: payload.customer.name,
      email: payload.customer.email,
      phone: payload.customer.phone,
      address: payload.customer.address,
      apartment: payload.customer.apartment ?? null,
      city: payload.customer.city,
      state: payload.customer.state,
      zip_code: payload.customer.zipCode,
      notes: payload.customer.notes ?? null,
    },
    items: payload.items.map((item) => ({
      product_id: item.productId,
      product_name: item.productName,
      product_slug: item.productSlug,
      strength_mg: item.strengthMg,
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents,
      subtotal_cents: item.subtotalCents,
    })),
  };
}

/**
 * Narrows the RPC's `jsonb` return.
 *
 * Generated types describe it as `Json`, so this is the boundary that turns it into
 * something the rest of the application can rely on. A malformed result means the
 * function changed under us, which is a database error rather than a customer error.
 */
function toReceipt(value: unknown): InquiryReceipt {
  if (typeof value !== "object" || value === null) {
    throw new DatabaseError("orders.create", "create_inquiry returned a non-object");
  }

  const record = value as Record<string, unknown>;

  if (typeof record.order_id !== "string" || typeof record.order_number !== "string") {
    throw new DatabaseError("orders.create", "create_inquiry returned no order identity");
  }

  return {
    orderId: record.order_id,
    orderNumber: record.order_number,
    created: record.created === true,
  };
}

export function createOrderRepository(): OrderRepository {
  return {
    async create(payload): Promise<InquiryReceipt> {
      // Resolved per call rather than at module scope: the write client throws when
      // the service-role key is absent, and that must not happen while merely
      // building the container for a read-only page.
      const client = getWriteClient();

      const { data, error } = await client.rpc("create_inquiry", {
        p_payload: toRpcPayload(payload),
      });

      if (error) {
        throw new DatabaseError("orders.create", error.message, { cause: error });
      }

      return toReceipt(data);
    },
  };
}

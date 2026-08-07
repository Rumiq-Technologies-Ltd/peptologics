import type { InquiryCustomerInput } from "@/lib/validations/inquiry.schema";

/**
 * Domain types for the inquiry write path.
 *
 * The distinction that matters here is between what the browser sends and what the
 * server persists. A request carries `{ productId, quantity }`; everything below
 * that mentions money was produced server-side from `products.price_cents`
 * (ADR-005). No type in this file can be constructed from a request payload alone.
 */

/**
 * One persisted line, priced by the server.
 *
 * Name, slug and strength are snapshots: the follow-up call needs to show what the
 * customer actually saw, and a later rename or repricing must not rewrite history.
 */
export interface InquiryLineItem {
  productId: string;
  productName: string;
  productSlug: string;
  strengthMg: number;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
}

/** Exactly what the `create_inquiry` RPC needs, before snake_casing. */
export interface CreateInquiryPayload {
  /** Client-generated per form mount. The whole idempotency mechanism. */
  idempotencyKey: string;
  customer: InquiryCustomerInput;
  items: InquiryLineItem[];
  subtotalCents: number;
  ruoAcknowledgedAt?: string;
}

/** What the RPC reports back. `created: false` means this was a replay. */
export interface InquiryReceipt {
  orderId: string;
  orderNumber: string;
  created: boolean;
}

/**
 * What the service returns to the Route Handler.
 *
 * `orderNumber` is null for a submission that was silently suppressed — a filled
 * honeypot or an impossibly fast post. The caller cannot distinguish that from a
 * real success, which is the point: a bot must learn nothing.
 */
export interface InquiryResult {
  orderNumber: string | null;
  /** False for a replayed idempotency key and for a suppressed submission. */
  created: boolean;
}

/** Everything a notification channel needs. Built after the order is committed. */
export interface InquiryNotification {
  orderId: string;
  orderNumber: string;
  customer: InquiryCustomerInput;
  items: InquiryLineItem[];
  subtotalCents: number;
}

/**
 * Email is the only channel.
 *
 * The union exists rather than being inlined so adding a second channel later is a
 * one-line change here plus an adapter — the notification service, the log table and
 * the repository are all already channel-generic. WhatsApp was removed in favour of
 * email alone; see ADR-023.
 */
export type NotificationChannel = "email";

export type NotificationStatus = "sent" | "failed" | "skipped";

export interface NotificationOutcome {
  channel: NotificationChannel;
  status: NotificationStatus;
  providerMessageId?: string;
  /** Technical detail for the operator. Never shown to a customer. */
  errorMessage?: string;
  attempts: number;
}

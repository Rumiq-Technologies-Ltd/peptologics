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
  /**
   * The canonical code that was actually applied, or undefined.
   *
   * Not what the visitor typed — what the server recognised. A mistyped code reaches
   * the service and leaves no trace on the order, which is what the visitor was told
   * would happen.
   */
  couponCode?: string;
  /** Integer cents taken off, computed server-side. Zero when no coupon applied. */
  discountCents: number;
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
  /** Integer cents taken off by a coupon. Zero when none applied. */
  discountCents: number;
  /** Subtotal minus discount. What the representative should quote from. */
  totalCents: number;
}

/**
 * The two things an inquiry triggers, both over email.
 *
 * `email` is the internal notification — the lead landing in the company inbox. It keeps
 * its original name because renaming it would mean rewriting historical
 * `notification_log` rows to say the same thing differently, and the log is a record, not
 * a model. `customer_email` is the confirmation sent to the person who filled the form
 * (ADR-027).
 *
 * They are separate channels rather than one send with two recipients because they fail
 * independently and matter differently: a lead nobody was told about is a lost sale, a
 * confirmation that never arrived is a customer wondering whether the form worked. The
 * dead-letter list has to be able to say which one happened.
 *
 * WhatsApp was removed in favour of email alone; see ADR-023.
 */
export type NotificationChannel = "email" | "customer_email";

export type NotificationStatus = "sent" | "failed" | "skipped";

export interface NotificationOutcome {
  channel: NotificationChannel;
  status: NotificationStatus;
  providerMessageId?: string;
  /** Technical detail for the operator. Never shown to a customer. */
  errorMessage?: string;
  attempts: number;
}

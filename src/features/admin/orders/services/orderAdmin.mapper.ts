import type {
  AdminNotification,
  AdminOrder,
  AdminOrderLine,
  AdminOrderNote,
  AdminOrderSummary,
  NotificationStatus,
  OrderStatus,
} from "@/features/admin/orders/types";
import { ORDER_STATUSES } from "@/features/admin/orders/types";
import type { AdminRole } from "@/lib/admin/roles";
import type { Item } from "@/lib/dynamodb/entities";

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function orderStatus(value: unknown): OrderStatus {
  return ORDER_STATUSES.find((status) => status === value) ?? "new";
}

/** A stored order item to a list row. `emailProblem` comes from the open-notifications index. */
export function toOrderSummary(item: Item, emailProblem: boolean): AdminOrderSummary {
  return {
    id: String(item.id),
    orderNumber: String(item.order_number),
    createdAt: String(item.created_at),
    customerName: String(item.customer_name ?? ""),
    email: String(item.email ?? ""),
    itemCount: Number(item.item_count ?? 0),
    totalCents: Number(item.total_cents ?? 0),
    status: orderStatus(item.status),
    deletedAt: text(item.deleted_at),
    emailProblem,
  };
}

export function toAdminOrder(item: Item, emailProblem: boolean): AdminOrder {
  const createdAt = String(item.created_at);

  return {
    ...toOrderSummary(item, emailProblem),
    phone: String(item.phone ?? ""),
    address: String(item.address ?? ""),
    apartment: text(item.apartment),
    city: String(item.city ?? ""),
    state: String(item.state ?? ""),
    zipCode: String(item.zip_code ?? ""),
    country: String(item.country ?? ""),
    customerNotes: text(item.notes),
    subtotalCents: Number(item.subtotal_cents ?? 0),
    couponCode: text(item.coupon_code),
    discountCents: Number(item.discount_cents ?? 0),
    ruoAcknowledgedAt: text(item.ruo_acknowledged_at),
    version: typeof item.version === "number" ? item.version : 0,
    updatedAt: text(item.updated_at) ?? createdAt,
  };
}

export function toOrderLine(item: Item): AdminOrderLine {
  return {
    productId: String(item.product_id),
    productName: String(item.product_name ?? ""),
    strengthMg: Number(item.strength_mg ?? 0),
    quantity: Number(item.quantity ?? 0),
    unitPriceCents: Number(item.unit_price_cents ?? 0),
    subtotalCents: Number(item.subtotal_cents ?? 0),
  };
}

const NOTIFICATION_STATUSES: readonly NotificationStatus[] = [
  "pending",
  "sent",
  "failed",
  "skipped",
];

/** Delivery facts only: the provider's error text is left out on purpose. */
export function toNotification(item: Item): AdminNotification {
  const createdAt = String(item.created_at);

  return {
    channel: item.channel === "customer_email" ? "customer_email" : "email",
    status: NOTIFICATION_STATUSES.find((status) => status === item.status) ?? "pending",
    attempts: Number(item.attempts ?? 0),
    sentAt: text(item.sent_at),
    createdAt,
    updatedAt: text(item.updated_at) ?? createdAt,
  };
}

export function toOrderNote(item: Item): AdminOrderNote {
  return {
    id: String(item.id),
    body: String(item.body ?? ""),
    authorEmail: String(item.author_email ?? ""),
    authorRole: (item.author_role === "owner" ? "owner" : "editor") satisfies AdminRole,
    createdAt: String(item.created_at),
  };
}

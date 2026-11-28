import type { AdminRole } from "@/lib/admin/roles";

/** The five order statuses (the database CHECK). Staff may move an order to any of them (D41). */
export const ORDER_STATUSES = ["new", "contacted", "confirmed", "cancelled", "completed"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "New",
  contacted: "Contacted",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
};

/** One row of the orders list. Holds only what the list shows. */
export interface AdminOrderSummary {
  id: string;
  orderNumber: string;
  /** ISO 8601, UTC. */
  createdAt: string;
  customerName: string;
  email: string;
  itemCount: number;
  totalCents: number;
  status: OrderStatus;
  /** ISO 8601, UTC, when staff hid it as test or spam. Null when it is visible. */
  deletedAt: string | null;
  /** True when a notification is still pending or failed (the dead-letter index). */
  emailProblem: boolean;
}

/** An order with everything the detail page shows. Customer contents are read-only (D41). */
export interface AdminOrder extends AdminOrderSummary {
  phone: string;
  address: string;
  apartment: string | null;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  /** What the customer wrote. */
  customerNotes: string | null;
  subtotalCents: number;
  couponCode: string | null;
  discountCents: number;
  ruoAcknowledgedAt: string | null;
  /** Optimistic-lock counter. 0 for an order never saved from the admin. */
  version: number;
  updatedAt: string;
}

export interface AdminOrderLine {
  productId: string;
  productName: string;
  strengthMg: number;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
}

export type NotificationStatus = "pending" | "sent" | "failed" | "skipped";

/** The delivery record of one email. Never the message, and never the provider's error text. */
export interface AdminNotification {
  channel: "email" | "customer_email";
  status: NotificationStatus;
  attempts: number;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderNote {
  id: string;
  body: string;
  authorEmail: string;
  authorRole: AdminRole;
  createdAt: string;
}

export interface AdminOrderDetail {
  order: AdminOrder;
  lines: AdminOrderLine[];
  notifications: AdminNotification[];
  notes: AdminOrderNote[];
}

/** What a successful status, hide or restore returns to the action layer. */
export interface OrderChangeOutcome {
  order: AdminOrder;
  /** False when the save changed nothing. */
  changed: boolean;
}

/** Who is making a change, for the audit log. */
export interface AdminActor {
  email: string;
  role: AdminRole;
  requestId: string;
}

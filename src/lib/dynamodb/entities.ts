/**
 * The single-table layout (ADR-035): key formats and item builders.
 *
 * Deliberately free of runtime imports, aliases and `server-only`. The app's repositories
 * and the Supabase migration script (`scripts/migrate-supabase-to-dynamodb.ts`, run with
 * plain Node) both build items here, so the two can never disagree about a key format.
 *
 * Attribute names are the old Postgres column names (snake_case). That keeps the existing
 * product mapper usable unchanged and makes a row-by-row comparison against Supabase a
 * plain field comparison. A null column is an absent attribute.
 */

export interface TableKey {
  PK: string;
  SK: string;
}

/** Index names. Created by the control chat; these must match exactly. */
export const INDEX = {
  /** Catalog (`PRODUCTS`) and orders by month (`ORDERS#yyyy-mm`). */
  primary: "GSI1",
  /** Product by slug. */
  slug: "GSI2",
  /** Notifications still `pending` or `failed`: the dead-letter list. */
  openNotifications: "GSI3",
} as const;

export const CATALOG_PARTITION = "PRODUCTS";
export const OPEN_NOTIFICATIONS_PARTITION = "NOTIF_OPEN";

/** The counter is advanced from this value, so a fresh table issues PL-001000 first. */
export const ORDER_COUNTER_START = 999;

/** Only `pending` and `failed` notifications are on the dead-letter index. */
const OPEN_NOTIFICATION_STATUSES: readonly string[] = ["pending", "failed"];

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const keys = {
  product: (productId: string): TableKey => ({ PK: `PRODUCT#${productId}`, SK: "META" }),
  slugGuard: (slug: string): TableKey => ({ PK: `SLUG#${slug}`, SK: "GUARD" }),
  order: (orderId: string): TableKey => ({ PK: `ORDER#${orderId}`, SK: "META" }),
  orderItem: (orderId: string, productId: string): TableKey => ({
    PK: `ORDER#${orderId}`,
    SK: `ITEM#${productId}`,
  }),
  notification: (orderId: string, channel: string): TableKey => ({
    PK: `ORDER#${orderId}`,
    SK: `NOTIF#${channel}`,
  }),
  idempotency: (idempotencyKey: string): TableKey => ({
    PK: `IDEMP#${idempotencyKey}`,
    SK: "GUARD",
  }),
  orderCounter: { PK: "COUNTER#order_number", SK: "META" } satisfies TableKey,
  rateLimit: (bucketKey: string, windowStartSeconds: number): TableKey => ({
    PK: `RL#${bucketKey}#${windowStartSeconds}`,
    SK: "META",
  }),
};

export type Item = Record<string, unknown>;

/** Drops `undefined` and `null`: DynamoDB models a missing value as a missing attribute. */
export function compact(attributes: Record<string, unknown>): Item {
  const item: Item = {};

  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null) item[name] = value;
  }

  return item;
}

/** `PL-` plus the sequence, zero-padded to six digits. Gaps are expected and fine. */
export function formatOrderNumber(sequence: number): string {
  return `PL-${String(sequence).padStart(6, "0")}`;
}

/** The numeric part of an order number, or null if it is not one. */
export function parseOrderNumber(orderNumber: string): number | null {
  const match = /^PL-(\d+)$/.exec(orderNumber);
  return match?.[1] ? Number(match[1]) : null;
}

// --- Products ----------------------------------------------------------------

export interface ProductSource {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  category: string;
  /** Postgres `numeric` arrives as a string; a number is accepted too. */
  strength_mg: number | string;
  strength_unit: string;
  price_cents: number;
  is_blend: boolean;
  featured: boolean;
  sort_order: number;
  image_url?: string | null;
  status: string;
  deleted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/** Dollars per milligram at full precision. Computed here, never taken from input. */
export function computeCostPerMg(priceCents: number, strengthMg: number): number {
  return priceCents / 100 / strengthMg;
}

/**
 * The product item plus its slug guard.
 *
 * The guard exists so that a transactional write of a new product (with
 * `attribute_not_exists` on the guard) can enforce slug uniqueness, which a
 * secondary index cannot.
 */
export function buildProductItems(product: ProductSource, now: string): Item[] {
  const strengthMg = Number(product.strength_mg);

  if (!SLUG_PATTERN.test(product.slug)) {
    throw new Error(`Product ${product.id} has an invalid slug.`);
  }
  if (!Number.isFinite(strengthMg) || strengthMg <= 0) {
    throw new Error(`Product ${product.id} has an invalid strength.`);
  }
  if (!Number.isInteger(product.price_cents) || product.price_cents < 0) {
    throw new Error(`Product ${product.id} has an invalid price.`);
  }
  if (product.strength_unit !== "mg" && product.strength_unit !== "ml") {
    throw new Error(`Product ${product.id} has an invalid strength unit.`);
  }

  const createdAt = product.created_at ?? now;

  const item = compact({
    ...keys.product(product.id),
    GSI1PK: CATALOG_PARTITION,
    // Zero-padded so the index sorts numerically; the name breaks ties.
    GSI1SK: `${String(product.sort_order).padStart(6, "0")}#${product.name}`,
    GSI2PK: `SLUG#${product.slug}`,
    entity: "product",
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    category: product.category,
    strength_mg: strengthMg,
    strength_unit: product.strength_unit,
    price_cents: product.price_cents,
    cost_per_mg: computeCostPerMg(product.price_cents, strengthMg),
    is_blend: product.is_blend,
    featured: product.featured,
    sort_order: product.sort_order,
    image_url: product.image_url,
    status: product.status,
    deleted_at: product.deleted_at,
    created_at: createdAt,
    updated_at: product.updated_at ?? createdAt,
  });

  const guard = compact({
    ...keys.slugGuard(product.slug),
    entity: "slug_guard",
    product_id: product.id,
  });

  return [item, guard];
}

// --- Orders ------------------------------------------------------------------

export interface OrderSource {
  id: string;
  order_number: string;
  idempotency_key: string;
  customer_name: string;
  email: string;
  phone: string;
  address: string;
  apartment?: string | null;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  notes?: string | null;
  subtotal_cents: number;
  currency: string;
  item_count: number;
  status: string;
  coupon_code?: string | null;
  discount_cents: number;
  total_cents: number;
  ruo_acknowledged_at?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

/** UTC `yyyy-mm` of a timestamp, for the per-month order listing. */
export function monthOf(timestamp: string): string {
  return new Date(timestamp).toISOString().slice(0, 7);
}

/**
 * The order item plus its idempotency guard. The guard repeats the order id and number,
 * so a replayed submission is answered from one read.
 */
export function buildOrderItems(order: OrderSource): Item[] {
  const sortable = new Date(order.created_at).toISOString();

  const item = compact({
    ...order,
    ...keys.order(order.id),
    GSI1PK: `ORDERS#${monthOf(order.created_at)}`,
    GSI1SK: sortable,
    entity: "order",
  });

  const guard = compact({
    ...keys.idempotency(order.idempotency_key),
    entity: "idempotency_guard",
    order_id: order.id,
    order_number: order.order_number,
    created_at: order.created_at,
  });

  return [item, guard];
}

export interface OrderLineSource {
  id?: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  strength_mg: number | string;
  quantity: number;
  unit_price_cents: number;
  subtotal_cents: number;
  created_at: string;
  updated_at?: string | null;
}

export function buildOrderLineItem(line: OrderLineSource): Item {
  return compact({
    ...line,
    ...keys.orderItem(line.order_id, line.product_id),
    strength_mg: Number(line.strength_mg),
    updated_at: line.updated_at ?? line.created_at,
    entity: "order_item",
  });
}

// --- Notifications -----------------------------------------------------------

export interface NotificationSource {
  id?: string;
  order_id: string;
  channel: string;
  status: string;
  provider_message_id?: string | null;
  error_message?: string | null;
  attempts: number;
  sent_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export function isOpenNotificationStatus(status: string): boolean {
  return OPEN_NOTIFICATION_STATUSES.includes(status);
}

/** Open notifications carry the sparse GSI3 keys; a settled one carries none. */
export function buildNotificationItem(notification: NotificationSource): Item {
  const open = isOpenNotificationStatus(notification.status);

  return compact({
    ...notification,
    ...keys.notification(notification.order_id, notification.channel),
    GSI3PK: open ? OPEN_NOTIFICATIONS_PARTITION : undefined,
    GSI3SK: open
      ? `${new Date(notification.created_at).toISOString()}#${notification.order_id}#${notification.channel}`
      : undefined,
    updated_at: notification.updated_at ?? notification.created_at,
    entity: "notification",
  });
}

import { describe, expect, it } from "vitest";

import {
  buildNotificationItem,
  buildOrderItems,
  buildOrderLineItem,
  buildProductItems,
  formatOrderNumber,
  keys,
  parseOrderNumber,
  type OrderSource,
  type ProductSource,
} from "@/lib/dynamodb/entities";

const NOW = "2026-11-24T10:00:00.000Z";

const product: ProductSource = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "bpc-157-10mg",
  name: "BPC-157",
  description: null,
  category: "peptide",
  strength_mg: "10.000",
  strength_unit: "mg",
  price_cents: 5000,
  is_blend: false,
  featured: true,
  sort_order: 20,
  image_url: "/products/bpc-157-10mg.webp",
  coa_url: null,
  status: "active",
};

const order: OrderSource = {
  id: "22222222-2222-4222-8222-222222222222",
  order_number: "PL-001000",
  idempotency_key: "33333333-3333-4333-8333-333333333333",
  customer_name: "Ada",
  email: "ada@example.com",
  phone: "5551234567",
  address: "1 Main St",
  apartment: null,
  city: "Austin",
  state: "TX",
  zip_code: "78701",
  country: "US",
  notes: null,
  subtotal_cents: 5000,
  currency: "USD",
  item_count: 1,
  status: "new",
  coupon_code: null,
  discount_cents: 0,
  total_cents: 5000,
  created_at: "2026-11-24T23:30:00.123456+00:00",
  updated_at: "2026-11-24T23:30:00.123456+00:00",
};

describe("order numbers", () => {
  it("formats and parses PL- numbers, zero-padded to six digits", () => {
    expect(formatOrderNumber(1000)).toBe("PL-001000");
    expect(parseOrderNumber("PL-001234")).toBe(1234);
    expect(parseOrderNumber("nonsense")).toBeNull();
  });
});

describe("buildProductItems", () => {
  it("writes the catalog keys, the slug key and a guard, and computes cost_per_mg itself", () => {
    const [item, guard] = buildProductItems(
      { ...product, cost_per_mg: 999 } as ProductSource & { cost_per_mg: number },
      NOW,
    );

    expect(item).toMatchObject({
      PK: `PRODUCT#${product.id}`,
      SK: "META",
      GSI1PK: "PRODUCTS",
      GSI1SK: "000020#BPC-157",
      GSI2PK: "SLUG#bpc-157-10mg",
      strength_mg: 10,
      cost_per_mg: 5,
    });
    expect(guard).toMatchObject({ PK: "SLUG#bpc-157-10mg", SK: "GUARD", product_id: product.id });
  });

  it("omits null columns instead of storing them", () => {
    const [item] = buildProductItems(product, NOW);
    expect(item).not.toHaveProperty("description");
    expect(item).not.toHaveProperty("coa_url");
  });

  it.each([
    ["an invalid slug", { slug: "Not A Slug" }],
    ["a zero strength", { strength_mg: 0 }],
    ["a fractional price", { price_cents: 10.5 }],
    ["an unknown unit", { strength_unit: "kg" }],
  ])("refuses %s", (_label, override) => {
    expect(() => buildProductItems({ ...product, ...override }, NOW)).toThrow();
  });
});

describe("buildOrderItems", () => {
  it("files the order under its UTC month and repeats the identity on the guard", () => {
    const [item, guard] = buildOrderItems(order);

    expect(item).toMatchObject({
      PK: `ORDER#${order.id}`,
      SK: "META",
      GSI1PK: "ORDERS#2026-11",
      GSI1SK: "2026-11-24T23:30:00.123Z",
      // The original timestamp is kept verbatim.
      created_at: order.created_at,
    });
    expect(guard).toMatchObject({
      PK: `IDEMP#${order.idempotency_key}`,
      SK: "GUARD",
      order_id: order.id,
      order_number: "PL-001000",
    });
  });
});

describe("notification and line items", () => {
  const base = { order_id: order.id, channel: "email", attempts: 0, created_at: NOW };

  it("keeps pending and failed notifications on the sparse dead-letter index", () => {
    for (const status of ["pending", "failed"]) {
      expect(buildNotificationItem({ ...base, status })).toMatchObject({
        GSI3PK: "NOTIF_OPEN",
        GSI3SK: `${NOW}#${order.id}#email`,
      });
    }
  });

  it("takes sent and skipped notifications off the index", () => {
    for (const status of ["sent", "skipped"]) {
      const item = buildNotificationItem({ ...base, status });
      expect(item).not.toHaveProperty("GSI3PK");
      expect(item).not.toHaveProperty("GSI3SK");
    }
  });

  it("makes one line per product by sort key", () => {
    const line = buildOrderLineItem({
      order_id: order.id,
      product_id: product.id,
      product_name: "BPC-157",
      product_slug: product.slug,
      strength_mg: "10.000",
      quantity: 2,
      unit_price_cents: 5000,
      subtotal_cents: 10000,
      created_at: NOW,
    });

    expect(line).toMatchObject({ ...keys.orderItem(order.id, product.id), strength_mg: 10 });
  });
});

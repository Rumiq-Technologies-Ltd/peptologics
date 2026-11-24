import { describe, expect, it } from "vitest";

import { validPayload } from "@/features/inquiry/services/order.fixtures";
import { findOrderViolations } from "@/features/inquiry/services/order.invariants";

/**
 * Each case names the Postgres CHECK constraint the rule replaces, so a failing test says
 * which database guarantee is no longer being kept.
 */

describe("findOrderViolations", () => {
  it("accepts a well-formed order", () => {
    expect(findOrderViolations(validPayload())).toEqual([]);
  });

  it.each([
    ["orders_name_length", { name: "   " }],
    ["orders_email_format", { email: "not-an-email" }],
    ["orders_phone_length", { phone: "123" }],
    ["orders_state_length", { state: "T" }],
    ["orders_zip_length", { zipCode: "12" }],
    ["orders_notes_length", { notes: "x".repeat(2001) }],
    ["orders_apartment_length", { apartment: "x".repeat(121) }],
  ])("rejects %s", (rule, customerOverride) => {
    const base = validPayload();
    const payload = { ...base, customer: { ...base.customer, ...customerOverride } };
    expect(findOrderViolations(payload)).toContain(rule);
  });

  it("rejects a quantity outside 1-99 (order_items_quantity_range)", () => {
    const [item] = validPayload().items;
    const payload = validPayload({
      items: [{ ...item!, quantity: 100, subtotalCents: 500000 }],
      subtotalCents: 500000,
    });
    expect(findOrderViolations(payload)).toContain("order_items_quantity_range");
  });

  it("rejects a line whose subtotal is not price x quantity (order_items_subtotal_matches)", () => {
    const [item] = validPayload().items;
    const payload = validPayload({ items: [{ ...item!, subtotalCents: 1 }], subtotalCents: 1 });
    expect(findOrderViolations(payload)).toContain("order_items_subtotal_matches");
  });

  it("rejects a non-positive unit price (order_items_unit_price_positive)", () => {
    const [item] = validPayload().items;
    const payload = validPayload({
      items: [{ ...item!, unitPriceCents: 0, subtotalCents: 0 }],
      subtotalCents: 0,
    });
    expect(findOrderViolations(payload)).toContain("order_items_unit_price_positive");
  });

  it("rejects a duplicated product (order_items_one_row_per_product)", () => {
    const [item] = validPayload().items;
    const payload = validPayload({
      items: [item!, item!],
      subtotalCents: 20000,
    });
    expect(findOrderViolations(payload)).toContain("order_items_one_row_per_product");
  });

  it("rejects an empty order and one over the line limit", () => {
    expect(findOrderViolations(validPayload({ items: [], subtotalCents: 0 }))).toContain(
      "order_item_count",
    );
  });

  it("rejects a subtotal that disagrees with its lines", () => {
    expect(findOrderViolations(validPayload({ subtotalCents: 9999 }))).toContain(
      "orders_subtotal_matches_items",
    );
  });

  it("rejects a discount that is negative or exceeds the subtotal", () => {
    expect(findOrderViolations(validPayload({ discountCents: -1 }))).toContain(
      "orders_discount_nonnegative",
    );
    expect(findOrderViolations(validPayload({ discountCents: 10001 }))).toContain(
      "orders_discount_within_subtotal",
    );
  });

  it("rejects an idempotency key that is not a UUID", () => {
    expect(findOrderViolations(validPayload({ idempotencyKey: "abc" }))).toContain(
      "idempotency_key_uuid",
    );
  });
});

import { MAX_DISTINCT_LINES, MAX_LINE_QUANTITY, MIN_LINE_QUANTITY } from "@/constants/business";
import type { CreateInquiryPayload } from "@/features/inquiry/types/inquiry";

/**
 * The rules Postgres used to enforce with CHECK constraints, now enforced in code.
 *
 * DynamoDB accepts any item, so the last line of defence the database used to provide has
 * to live here. The Zod schema and the inquiry service already reject bad input with field
 * errors; this guard runs immediately before the write and exists so that a bug upstream
 * becomes a refused write rather than a malformed order (CLAUDE.md: validate at every
 * layer). Each rule names the old constraint it replaces.
 *
 * Returns the violated rules. They name rules and fields, never customer values.
 */

const EMAIL_FORMAT = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_COUPON_LENGTH = 40;

function lengthBetween(value: string, min: number, max: number): boolean {
  const length = value.trim().length;
  return length >= min && length <= max;
}

export function findOrderViolations(payload: CreateInquiryPayload): string[] {
  const violations: string[] = [];
  const { customer, items } = payload;

  if (!UUID_FORMAT.test(payload.idempotencyKey)) violations.push("idempotency_key_uuid");

  // orders_*_length and orders_email_format
  if (!lengthBetween(customer.name, 1, 200)) violations.push("orders_name_length");
  if (customer.email.length < 5 || customer.email.length > 254)
    violations.push("orders_email_length");
  if (!EMAIL_FORMAT.test(customer.email)) violations.push("orders_email_format");
  if (!lengthBetween(customer.phone, 7, 32)) violations.push("orders_phone_length");
  if (!lengthBetween(customer.address, 1, 300)) violations.push("orders_address_length");
  if (customer.apartment !== undefined && customer.apartment.length > 120) {
    violations.push("orders_apartment_length");
  }
  if (!lengthBetween(customer.city, 1, 120)) violations.push("orders_city_length");
  if (!lengthBetween(customer.state, 2, 100)) violations.push("orders_state_length");
  if (!lengthBetween(customer.zipCode, 3, 20)) violations.push("orders_zip_length");
  if (customer.notes !== undefined && customer.notes.length > 2000) {
    violations.push("orders_notes_length");
  }

  if (
    payload.couponCode !== undefined &&
    !lengthBetween(payload.couponCode, 1, MAX_COUPON_LENGTH)
  ) {
    violations.push("orders_coupon_code_length");
  }

  // order has items, one line per product (order_items_one_row_per_product)
  if (items.length < 1 || items.length > MAX_DISTINCT_LINES) violations.push("order_item_count");
  if (new Set(items.map((item) => item.productId)).size !== items.length) {
    violations.push("order_items_one_row_per_product");
  }

  let itemsTotal = 0;

  for (const item of items) {
    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < MIN_LINE_QUANTITY ||
      item.quantity > MAX_LINE_QUANTITY
    ) {
      violations.push("order_items_quantity_range");
    }
    if (!Number.isInteger(item.unitPriceCents) || item.unitPriceCents <= 0) {
      violations.push("order_items_unit_price_positive");
    }
    if (!Number.isFinite(item.strengthMg) || item.strengthMg <= 0) {
      violations.push("order_items_strength_positive");
    }
    if (item.subtotalCents !== item.unitPriceCents * item.quantity) {
      violations.push("order_items_subtotal_matches");
    }
    itemsTotal += item.subtotalCents;
  }

  // orders_subtotal_nonnegative, orders_discount_nonnegative, orders_discount_within_subtotal
  if (!Number.isInteger(payload.subtotalCents) || payload.subtotalCents < 0) {
    violations.push("orders_subtotal_nonnegative");
  }
  if (payload.subtotalCents !== itemsTotal) violations.push("orders_subtotal_matches_items");
  if (!Number.isInteger(payload.discountCents) || payload.discountCents < 0) {
    violations.push("orders_discount_nonnegative");
  }
  if (payload.discountCents > payload.subtotalCents) {
    violations.push("orders_discount_within_subtotal");
  }

  return [...new Set(violations)];
}

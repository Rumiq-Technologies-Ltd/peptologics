import { describe, expect, it } from "vitest";

import { MAX_DISTINCT_LINES } from "@/constants/business";
import {
  inquiryCustomerSchema,
  inquirySchema,
  toFieldErrors,
} from "@/lib/validations/inquiry.schema";
import { makeCustomer } from "@/test/factories";

/**
 * The inquiry contract.
 *
 * The schema is the one piece of validation the browser and the server share, so a bug
 * here is a bug in both at once. The price-authority test at the bottom is the most
 * important assertion in this file.
 */

const PRODUCT_ID = "3f6c6d1e-9b1a-4a2f-9f5c-2b7d0c9a1e44";

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    customer: makeCustomer(),
    items: [{ productId: PRODUCT_ID, quantity: 2 }],
    formStartedAt: 1_754_500_000_000,
    ...overrides,
  };
}

describe("inquiryCustomerSchema — normalisation", () => {
  it("trims and collapses whitespace in a name", () => {
    const parsed = inquiryCustomerSchema.parse(makeCustomer({ name: "  Dr Ada   Lovelace  " }));
    expect(parsed.name).toBe("Dr Ada Lovelace");
  });

  it("lowercases the email, so duplicate-lead detection works", () => {
    const parsed = inquiryCustomerSchema.parse(makeCustomer({ email: " ADA@Example.COM " }));
    expect(parsed.email).toBe("ada@example.com");
  });

  it("rejects a name made only of invisible characters", () => {
    // Zero-width characters survive `.trim()` and pass a naive `.min(1)`. Sanitising
    // strips them, and the schema re-measures afterwards, which is what catches this.
    const result = inquiryCustomerSchema.safeParse(makeCustomer({ name: "​​​" }));
    expect(result.success).toBe(false);
  });

  it("turns an empty optional field into undefined rather than an empty string", () => {
    const parsed = inquiryCustomerSchema.parse(makeCustomer({ apartment: "   ", notes: "" }));
    expect(parsed.apartment).toBeUndefined();
    expect(parsed.notes).toBeUndefined();
  });

  it("keeps paragraph breaks in notes but collapses blank runs", () => {
    const parsed = inquiryCustomerSchema.parse(
      makeCustomer({ notes: "First line.\n\n\n\nSecond line." }),
    );
    expect(parsed.notes).toBe("First line.\n\nSecond line.");
  });

  it("strips characters a phone number cannot contain", () => {
    const parsed = inquiryCustomerSchema.parse(makeCustomer({ phone: "+1 (555) 010-2030 ext" }));
    expect(parsed.phone).toBe("+1 (555) 010-2030");
  });
});

describe("inquiryCustomerSchema — required fields", () => {
  const requiredFields = ["name", "email", "phone", "address", "city", "state", "zipCode"] as const;

  it.each(requiredFields)("rejects a missing %s", (field) => {
    const result = inquiryCustomerSchema.safeParse(makeCustomer({ [field]: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email with a message a customer can act on", () => {
    const result = inquiryCustomerSchema.safeParse(makeCustomer({ email: "ada@example" }));

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("valid email address");
  });

  it("rejects a value beyond the matching database CHECK", () => {
    // 200 is the orders.customer_name limit. Schema and constraint must agree, or a
    // value passes here and fails there as a 500 instead of a field error.
    expect(inquiryCustomerSchema.safeParse(makeCustomer({ name: "x".repeat(200) })).success).toBe(
      true,
    );
    expect(inquiryCustomerSchema.safeParse(makeCustomer({ name: "x".repeat(201) })).success).toBe(
      false,
    );
  });
});

describe("inquirySchema — the price authority guarantee", () => {
  it("strips every price-shaped field a caller might inject", () => {
    const parsed = inquirySchema.parse(
      validBody({
        items: [
          {
            productId: PRODUCT_ID,
            quantity: 1,
            unitPriceCents: 1,
            priceCents: 1,
            price: 0.01,
            subtotalCents: 1,
          },
        ],
        subtotalCents: 1,
        total: 1,
      }),
    );

    // The parsed item has exactly two keys. There is no field in which to send a price,
    // which is why a tampered payload cannot influence one (ADR-005).
    expect(Object.keys(parsed.items[0] ?? {}).sort()).toEqual(["productId", "quantity"]);
    expect(parsed).not.toHaveProperty("subtotalCents");
    expect(parsed).not.toHaveProperty("total");
  });
});

describe("inquirySchema — items", () => {
  it("requires at least one product", () => {
    const result = inquirySchema.safeParse(validBody({ items: [] }));
    expect(result.success).toBe(false);
  });

  it("rejects the same product twice, which the database would reject as a constraint", () => {
    const result = inquirySchema.safeParse(
      validBody({
        items: [
          { productId: PRODUCT_ID, quantity: 1 },
          { productId: PRODUCT_ID, quantity: 2 },
        ],
      }),
    );

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("only once");
  });

  it("rejects more distinct products than an inquiry allows", () => {
    const items = Array.from({ length: MAX_DISTINCT_LINES + 1 }, (_, index) => ({
      productId: `3f6c6d1e-9b1a-4a2f-9f5c-2b7d0c9a1e${String(index).padStart(2, "0")}`,
      quantity: 1,
    }));

    expect(inquirySchema.safeParse(validBody({ items })).success).toBe(false);
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["fractional", 1.5],
    ["above the cap", 100],
  ])("rejects a %s quantity", (_label, quantity) => {
    expect(
      inquirySchema.safeParse(validBody({ items: [{ productId: PRODUCT_ID, quantity }] })).success,
    ).toBe(false);
  });

  it("rejects a product id that is not a UUID", () => {
    expect(
      inquirySchema.safeParse(validBody({ items: [{ productId: "../../etc", quantity: 1 }] }))
        .success,
    ).toBe(false);
  });
});

describe("inquirySchema — anti-spam fields", () => {
  it("accepts a filled honeypot rather than rejecting it", () => {
    // Deliberate: rejecting here would tell a bot which field trapped it. The service
    // decides what to do, and its answer is an ordinary success (ADR-021).
    const result = inquirySchema.safeParse(validBody({ honeypot: "https://spam.example" }));
    expect(result.success).toBe(true);
  });

  it("accepts a body with no dwell timestamp, leaving the decision to the service", () => {
    const result = inquirySchema.safeParse(validBody({ formStartedAt: undefined }));
    expect(result.success).toBe(true);
  });

  it("rejects a non-ISO acknowledgement timestamp", () => {
    expect(inquirySchema.safeParse(validBody({ ruoAcknowledgedAt: "yesterday" })).success).toBe(
      false,
    );
  });
});

describe("toFieldErrors", () => {
  it("keys messages by dotted path, so the form can map them back onto fields", () => {
    const result = inquirySchema.safeParse(
      validBody({ customer: makeCustomer({ email: "nope", name: "" }) }),
    );

    expect(result.success).toBe(false);
    const fieldErrors = toFieldErrors(result.error!);

    expect(Object.keys(fieldErrors)).toEqual(
      expect.arrayContaining(["customer.email", "customer.name"]),
    );
    expect(fieldErrors["customer.email"]?.[0]).toContain("valid email address");
  });
});

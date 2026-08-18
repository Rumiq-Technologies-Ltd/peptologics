import { describe, expect, it } from "vitest";

import { INQUIRY_RESPONSE_HOURS } from "@/constants/business";
import { buildCustomerConfirmationEmail } from "@/features/inquiry/templates/customerConfirmation";
import type { InquiryNotification } from "@/features/inquiry/types/inquiry";
import { makeCustomer } from "@/test/factories";

/**
 * The confirmation the customer receives.
 *
 * Three things are worth a test here, and they are the three that would be expensive to
 * get wrong in front of a customer: that it never calls an inquiry an order, that the
 * promised response time comes from the constant rather than a hardcoded number, and that
 * a hostile value in a form field cannot reach the reader's mail client as markup.
 */

function makeNotification(overrides: Partial<InquiryNotification> = {}): InquiryNotification {
  return {
    orderId: "order-1",
    orderNumber: "PL-001000",
    customer: makeCustomer() as InquiryNotification["customer"],
    items: [
      {
        productId: "product-1",
        productName: "Retatrutide",
        productSlug: "retatrutide-10mg",
        strengthMg: 10,
        quantity: 2,
        unitPriceCents: 6000,
        subtotalCents: 12000,
      },
    ],
    subtotalCents: 12000,
    discountCents: 0,
    totalCents: 12000,
    ...overrides,
  };
}

describe("buildCustomerConfirmationEmail", () => {
  it("never describes the inquiry as an order or a purchase", async () => {
    const { subject, text, html } = buildCustomerConfirmationEmail(makeNotification());

    /*
     * The site is not a payment platform, and this email is the version a customer keeps.
     * "your order" here would be the one place we told them they had bought something.
     * Matched case-insensitively, and "inquiry, not an order" is allowed because it is the
     * disclaimer rather than a claim.
     */
    const claims = /\b(your order|order placed|order confirmed|purchase|receipt|invoice|paid)\b/i;

    expect(subject).not.toMatch(claims);
    expect(text).not.toMatch(claims);
    expect(html).not.toMatch(claims);

    expect(subject).toContain("inquiry");
    expect(text).toContain("No payment has been taken");
  });

  it("promises the response window from the constant, in both bodies", async () => {
    const { text, html } = buildCustomerConfirmationEmail(makeNotification());

    expect(text).toContain(`within ${INQUIRY_RESPONSE_HOURS} hours`);
    expect(html).toContain(`within ${INQUIRY_RESPONSE_HOURS} hours`);
  });

  it("carries the reference and the figures the visitor was shown", async () => {
    const { text, html } = buildCustomerConfirmationEmail(makeNotification());

    expect(text).toContain("PL-001000");
    expect(html).toContain("PL-001000");
    // Two vials at $60.00, as priced server-side from the catalog.
    expect(text).toContain("$120.00");
    expect(html).toContain("$120.00");
  });

  it("shows the discount lines only when a coupon actually applied", async () => {
    const without = buildCustomerConfirmationEmail(makeNotification());
    expect(without.text).not.toContain("Discount applied");

    const with_ = buildCustomerConfirmationEmail(
      makeNotification({ discountCents: 1200, totalCents: 10800 }),
    );
    expect(with_.text).toContain("Discount applied");
    expect(with_.text).toContain("$108.00");
    expect(with_.html).toContain("$108.00");
  });

  it("escapes a hostile name rather than emitting it as markup", async () => {
    const { html } = buildCustomerConfirmationEmail(
      makeNotification({
        customer: makeCustomer({
          name: '<script>alert("x")</script>',
        }) as InquiryNotification["customer"],
      }),
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("greets by first name only, and uses a single-word name whole", async () => {
    const twoNames = buildCustomerConfirmationEmail(makeNotification());
    expect(twoNames.text.startsWith("Hi Ada,")).toBe(true);
    expect(twoNames.text).not.toContain("Lovelace,");

    const oneName = buildCustomerConfirmationEmail(
      makeNotification({
        customer: makeCustomer({ name: "Prince" }) as InquiryNotification["customer"],
      }),
    );
    expect(oneName.text.startsWith("Hi Prince,")).toBe(true);
  });

  it("names the reply address when one is configured, and omits the sentence when not", async () => {
    const withAddress = buildCustomerConfirmationEmail(makeNotification(), {
      replyToAddress: "hello@peptologics.com",
    });
    expect(withAddress.text).toContain("hello@peptologics.com");
    expect(withAddress.html).toContain("mailto:hello@peptologics.com");

    const withoutAddress = buildCustomerConfirmationEmail(makeNotification());
    expect(withoutAddress.text).toContain("simply reply to this email");
    expect(withoutAddress.html).not.toContain("mailto:");
  });
});

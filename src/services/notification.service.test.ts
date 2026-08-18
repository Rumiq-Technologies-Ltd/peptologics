import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InquiryNotification, NotificationOutcome } from "@/features/inquiry/types/inquiry";
import type { EmailService } from "@/services/email.service";
import type { NotificationRepository } from "@/services/notification.repository";
import { createNotificationService } from "@/services/notification.service";
import { makeCustomer } from "@/test/factories";

/**
 * The notification dispatcher.
 *
 * One property matters more than any other here: **it cannot throw.** Dispatch runs
 * after the order is committed, so anything escaping this service would turn a saved
 * lead into an error page for the customer. Every test below is ultimately a test of
 * that, from a different direction.
 *
 * Two channels now run through it — the internal notification and the customer
 * confirmation (ADR-027) — and the second reason for these tests is that neither may be
 * able to affect the other. A channel that fails, or throws, must still leave the other's
 * outcome recorded.
 */

const notification: InquiryNotification = {
  orderId: "order-1",
  orderNumber: "PL-001000",
  customer: makeCustomer() as InquiryNotification["customer"],
  items: [
    {
      productId: "product-1",
      productName: "Retatrutide",
      productSlug: "retatrutide-10mg",
      strengthMg: 10,
      quantity: 1,
      unitPriceCents: 6000,
      subtotalCents: 6000,
    },
  ],
  subtotalCents: 6000,
  discountCents: 0,
  totalCents: 6000,
};

interface HarnessOptions {
  internal?: () => Promise<NotificationOutcome>;
  customer?: () => Promise<NotificationOutcome>;
}

function makeHarness({ internal, customer }: HarnessOptions = {}) {
  const sendInquiryNotification = vi.fn(
    internal ??
      (async (): Promise<NotificationOutcome> => ({
        channel: "email",
        status: "sent",
        providerMessageId: "resend-1",
        attempts: 1,
      })),
  );

  const sendCustomerConfirmation = vi.fn(
    customer ??
      (async (): Promise<NotificationOutcome> => ({
        channel: "customer_email",
        status: "sent",
        providerMessageId: "resend-2",
        attempts: 1,
      })),
  );

  const recordOutcome = vi.fn(async () => undefined);

  const service = createNotificationService({
    email: { sendInquiryNotification, sendCustomerConfirmation } as unknown as EmailService,
    repository: { recordOutcome } as unknown as NotificationRepository,
  });

  return { service, sendInquiryNotification, sendCustomerConfirmation, recordOutcome };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("dispatch", () => {
  it("records a successful send for each channel against the order", async () => {
    const { service, recordOutcome } = makeHarness();

    const outcomes = await service.dispatch(notification);

    expect(outcomes).toEqual([
      { channel: "email", status: "sent", providerMessageId: "resend-1", attempts: 1 },
      { channel: "customer_email", status: "sent", providerMessageId: "resend-2", attempts: 1 },
    ]);
    expect(recordOutcome).toHaveBeenCalledTimes(2);
    expect(recordOutcome).toHaveBeenCalledWith("order-1", outcomes[0]);
    expect(recordOutcome).toHaveBeenCalledWith("order-1", outcomes[1]);
  });

  it("records a reported failure without throwing", async () => {
    const { service, recordOutcome } = makeHarness({
      internal: async () => ({
        channel: "email",
        status: "failed",
        attempts: 3,
        errorMessage: "HTTP 500",
      }),
    });

    const outcomes = await service.dispatch(notification);

    expect(outcomes[0]?.status).toBe("failed");
    expect(recordOutcome).toHaveBeenCalledTimes(2);
  });

  it("converts a channel that throws into a failed outcome", async () => {
    // The channel services are written not to throw. "Written not to" is not "cannot",
    // and this is the last place a bug in one could reach the customer.
    const { service, recordOutcome } = makeHarness({
      internal: async () => {
        throw new Error("adapter exploded");
      },
    });

    const outcomes = await service.dispatch(notification);

    expect(outcomes[0]).toMatchObject({
      channel: "email",
      status: "failed",
      errorMessage: "adapter exploded",
    });
    expect(recordOutcome).toHaveBeenCalledTimes(2);
  });

  it("delivers and records the customer confirmation even when the internal channel throws", async () => {
    // The channels run concurrently and share nothing. A lead the company was never told
    // about must not also cost the customer their confirmation.
    const { service, recordOutcome } = makeHarness({
      internal: async () => {
        throw new Error("internal inbox unreachable");
      },
    });

    const outcomes = await service.dispatch(notification);

    expect(outcomes[1]).toMatchObject({ channel: "customer_email", status: "sent" });
    expect(recordOutcome).toHaveBeenCalledWith("order-1", outcomes[1]);
  });

  it("still records the internal notification when the confirmation throws", async () => {
    // The mirror case, and the more important one: the lead is the revenue.
    const { service, recordOutcome } = makeHarness({
      customer: async () => {
        throw new Error("customer mailbox rejected");
      },
    });

    const outcomes = await service.dispatch(notification);

    expect(outcomes[0]).toMatchObject({ channel: "email", status: "sent" });
    expect(outcomes[1]).toMatchObject({
      channel: "customer_email",
      status: "failed",
      errorMessage: "customer mailbox rejected",
    });
    expect(recordOutcome).toHaveBeenCalledTimes(2);
  });

  it("swallows a failed log write, leaving the row pending in the dead-letter list", async () => {
    const { service, recordOutcome } = makeHarness();
    recordOutcome.mockRejectedValueOnce(new Error("database unreachable"));

    // Resolves rather than rejecting: we cannot prove delivery, so the row stays
    // `pending`, which is the correct reading of what happened. The second write still
    // happens — one failing record must not abandon the other channel's outcome.
    await expect(service.dispatch(notification)).resolves.toHaveLength(2);
    expect(recordOutcome).toHaveBeenCalledTimes(2);
  });

  it("passes the notification through to both channels unchanged", async () => {
    const { service, sendInquiryNotification, sendCustomerConfirmation } = makeHarness();

    await service.dispatch(notification);

    expect(sendInquiryNotification).toHaveBeenCalledWith(notification);
    expect(sendCustomerConfirmation).toHaveBeenCalledWith(notification);
  });
});

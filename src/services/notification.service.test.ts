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
};

function makeHarness(sendImpl?: () => Promise<NotificationOutcome>) {
  const sendInquiryNotification = vi.fn(
    sendImpl ??
      (async (): Promise<NotificationOutcome> => ({
        channel: "email",
        status: "sent",
        providerMessageId: "resend-1",
        attempts: 1,
      })),
  );

  const recordOutcome = vi.fn(async () => undefined);

  const service = createNotificationService({
    email: { sendInquiryNotification } as unknown as EmailService,
    repository: { recordOutcome } as unknown as NotificationRepository,
  });

  return { service, sendInquiryNotification, recordOutcome };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("dispatch", () => {
  it("records a successful send against the order and channel", async () => {
    const { service, recordOutcome } = makeHarness();

    const outcomes = await service.dispatch(notification);

    expect(outcomes).toEqual([
      { channel: "email", status: "sent", providerMessageId: "resend-1", attempts: 1 },
    ]);
    expect(recordOutcome).toHaveBeenCalledWith("order-1", outcomes[0]);
  });

  it("records a reported failure without throwing", async () => {
    const { service, recordOutcome } = makeHarness(async () => ({
      channel: "email",
      status: "failed",
      attempts: 3,
      errorMessage: "HTTP 500",
    }));

    const outcomes = await service.dispatch(notification);

    expect(outcomes[0]?.status).toBe("failed");
    expect(recordOutcome).toHaveBeenCalledOnce();
  });

  it("converts a channel that throws into a failed outcome", async () => {
    // The channel services are written not to throw. "Written not to" is not "cannot",
    // and this is the last place a bug in one could reach the customer.
    const { service, recordOutcome } = makeHarness(async () => {
      throw new Error("adapter exploded");
    });

    const outcomes = await service.dispatch(notification);

    expect(outcomes[0]).toMatchObject({
      channel: "email",
      status: "failed",
      errorMessage: "adapter exploded",
    });
    expect(recordOutcome).toHaveBeenCalledOnce();
  });

  it("swallows a failed log write, leaving the row pending in the dead-letter list", async () => {
    const { service, recordOutcome } = makeHarness();
    recordOutcome.mockRejectedValueOnce(new Error("database unreachable"));

    // Resolves rather than rejecting: we cannot prove delivery, so the row stays
    // `pending`, which is the correct reading of what happened.
    await expect(service.dispatch(notification)).resolves.toHaveLength(1);
  });

  it("passes the notification through to the channel unchanged", async () => {
    const { service, sendInquiryNotification } = makeHarness();

    await service.dispatch(notification);

    expect(sendInquiryNotification).toHaveBeenCalledWith(notification);
  });
});

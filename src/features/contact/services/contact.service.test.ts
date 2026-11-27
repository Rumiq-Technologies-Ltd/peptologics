import { describe, expect, it, vi } from "vitest";

import { MESSAGES } from "@/constants/messages";
import {
  createContactService,
  type ContactEmailConfig,
} from "@/features/contact/services/contact.service";
import type { EmailMessage } from "@/lib/email";
import type { ContactRequest } from "@/lib/validations/contact.schema";

/**
 * The contact flow: spam filters, then the rate limit, then the company email, then the
 * confirmation. What matters most is what the visitor is told when one of the two emails
 * fails, because nothing is stored: the company email is the only copy of the message.
 */

const VISITOR = "visitor@example.com";

const CONFIG: ContactEmailConfig = {
  configured: true,
  companyFrom: "PeptoLogics <website@peptologics.com>",
  companyTo: ["hello@peptologics.com", "sales@peptologics.com"],
  visitorFrom: "PeptoLogics <hello@peptologics.com>",
};

function makeInput(overrides: Partial<ContactRequest> = {}): ContactRequest {
  return {
    name: "Ada Lovelace",
    email: VISITOR,
    message: "Do you have the 10 mg vial in stock?",
    honeypot: "",
    formElapsedMs: 12_000,
    ...overrides,
  };
}

function makeHarness(
  options: {
    allowed?: boolean;
    send?: (message: EmailMessage) => Promise<{ id: string }>;
    config?: Partial<ContactEmailConfig>;
  } = {},
) {
  const checkContact = vi.fn(async () => ({
    allowed: options.allowed ?? true,
    hitCount: 1,
    limit: 5,
    retryAfterSeconds: 120,
  }));
  const sendMessage = vi.fn(options.send ?? (async () => ({ id: "msg-1" })));

  const service = createContactService({
    rateLimit: { checkContact },
    sendMessage,
    config: { ...CONFIG, ...options.config },
  });

  return { service, checkContact, sendMessage };
}

const context = { clientKey: "hashed-ip" };

describe("ContactService.submit — delivery", () => {
  it("sends the company email, then the visitor confirmation", async () => {
    const { service, sendMessage } = makeHarness();

    const result = await service.submit(makeInput(), context);

    expect(result).toEqual({ success: true, data: { received: true } });
    expect(sendMessage).toHaveBeenCalledTimes(2);

    const [company, visitor] = sendMessage.mock.calls.map(([message]) => message);

    expect(company).toMatchObject({
      from: CONFIG.companyFrom,
      to: ["hello@peptologics.com", "sales@peptologics.com"],
      subject: "Website contact: Ada Lovelace",
      replyTo: VISITOR,
    });
    expect(company?.text).toContain("Do you have the 10 mg vial in stock?");

    expect(visitor).toMatchObject({
      from: CONFIG.visitorFrom,
      to: [VISITOR],
      replyTo: "hello@peptologics.com",
    });
  });

  it("returns an error, and sends no confirmation, when the company email fails", async () => {
    const { service, sendMessage } = makeHarness({
      send: async () => {
        throw new Error("provider down");
      },
    });

    const result = await service.submit(makeInput(), context);

    expect(result).toMatchObject({
      success: false,
      code: "UNEXPECTED",
      message: MESSAGES.contact.failed,
    });
    // A confirmation for a message that was never delivered would be a lie.
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("still succeeds when only the visitor confirmation fails", async () => {
    const { service, sendMessage } = makeHarness({
      send: async (message) => {
        if (message.to.includes(VISITOR)) throw new Error("bounced");
        return { id: "msg-1" };
      },
    });

    await expect(service.submit(makeInput(), context)).resolves.toEqual({
      success: true,
      data: { received: true },
    });
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it("does not expose the provider's error to the visitor", async () => {
    const { service } = makeHarness({
      send: async () => {
        throw new Error("AccessDenied: arn:aws:ses:us-east-1:123456789012:identity/x");
      },
    });

    const result = await service.submit(makeInput(), context);

    expect(JSON.stringify(result)).not.toContain("arn:aws");
  });

  it("returns the error state, not a fake success, when email is not configured", async () => {
    const { service, sendMessage } = makeHarness({ config: { configured: false } });

    const result = await service.submit(makeInput(), context);

    expect(result).toMatchObject({ success: false, message: MESSAGES.contact.failed });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("returns the error state when no recipient address is usable", async () => {
    const { service, sendMessage } = makeHarness({ config: { companyTo: [] } });

    await expect(service.submit(makeInput(), context)).resolves.toMatchObject({ success: false });
    expect(sendMessage).not.toHaveBeenCalled();
  });
});

describe("ContactService.submit — spam filters", () => {
  it.each([
    ["a filled honeypot", { honeypot: "http://spam.example" }],
    ["a missing elapsed time", { formElapsedMs: undefined }],
    ["a dwell under three seconds", { formElapsedMs: 2999 }],
  ])("answers %s with an ordinary success and does nothing", async (_label, override) => {
    const { service, sendMessage, checkContact } = makeHarness();

    const result = await service.submit(makeInput(override), context);

    expect(result).toEqual({ success: true, data: { received: true } });
    expect(sendMessage).not.toHaveBeenCalled();
    // A bot must cost nothing: not even a counter increment.
    expect(checkContact).not.toHaveBeenCalled();
  });

  it("accepts a dwell of exactly three seconds", async () => {
    const { service, sendMessage } = makeHarness();

    await service.submit(makeInput({ formElapsedMs: 3000 }), context);

    expect(sendMessage).toHaveBeenCalledTimes(2);
  });
});

describe("ContactService.submit — rate limit", () => {
  it("counts the submission in the contact bucket by the client key", async () => {
    const { service, checkContact } = makeHarness();

    await service.submit(makeInput(), context);

    expect(checkContact).toHaveBeenCalledWith("hashed-ip");
  });

  it("refuses a blocked client with the retry window, and sends nothing", async () => {
    const { service, sendMessage } = makeHarness({ allowed: false });

    const result = await service.submit(makeInput(), context);

    expect(result).toMatchObject({
      success: false,
      code: "RATE_LIMITED",
      message: MESSAGES.contact.rateLimited,
      retryAfterSeconds: 120,
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });
});

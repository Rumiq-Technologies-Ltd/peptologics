import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExternalServiceError, TimeoutError } from "@/lib/errors";
import { sendSesEmail, type SesMessage } from "@/lib/ses";

/**
 * The SES transport. What matters: the message id comes back, the configuration set and
 * reply-to reach SES, retry classification is right (a rejected message must fail fast, a
 * throttle must retry), and a CR/LF in any header field never reaches the network.
 */

const message: SesMessage = {
  from: "PeptoLogics <inquiries@peptologics.com>",
  to: ["hello@peptologics.com"],
  subject: "New inquiry",
  text: "plain",
  html: "<p>html</p>",
  replyTo: "customer@example.com",
};

let sesMock: ReturnType<typeof mockClient>;

beforeEach(() => {
  sesMock = mockClient(SESv2Client);
});

afterEach(() => {
  sesMock.restore();
  vi.useRealTimers();
});

function namedError(name: string, status?: number): Error {
  return Object.assign(new Error(name), { name, $metadata: { httpStatusCode: status } });
}

describe("sendSesEmail", () => {
  it("returns the MessageId and passes configuration set, reply-to and content through", async () => {
    sesMock.on(SendEmailCommand).resolves({ MessageId: "ses-123" });

    await expect(sendSesEmail(message, "peptologics-prod")).resolves.toEqual({ id: "ses-123" });

    const input = sesMock.commandCalls(SendEmailCommand)[0]?.args[0].input;
    expect(input?.ConfigurationSetName).toBe("peptologics-prod");
    expect(input?.ReplyToAddresses).toEqual(["customer@example.com"]);
    expect(input?.FromEmailAddress).toBe(message.from);
    expect(input?.Destination?.ToAddresses).toEqual(message.to);
    expect(input?.Content?.Simple?.Subject?.Data).toBe("New inquiry");
    expect(input?.Content?.Simple?.Body?.Text?.Data).toBe("plain");
    expect(input?.Content?.Simple?.Body?.Html?.Data).toBe("<p>html</p>");
  });

  it("omits reply-to when none is given", async () => {
    sesMock.on(SendEmailCommand).resolves({ MessageId: "ses-1" });

    await sendSesEmail({ ...message, replyTo: undefined }, "peptologics-prod");

    expect(
      sesMock.commandCalls(SendEmailCommand)[0]?.args[0].input.ReplyToAddresses,
    ).toBeUndefined();
  });

  it.each(["TooManyRequestsException", "ThrottlingException", "InternalServiceErrorException"])(
    "treats %s as retryable",
    async (name) => {
      sesMock.on(SendEmailCommand).rejects(namedError(name));

      const error = await sendSesEmail(message, "set").catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ExternalServiceError);
      expect((error as ExternalServiceError).retryable).toBe(true);
    },
  );

  it("treats an unnamed 5xx and a network failure as retryable", async () => {
    sesMock.on(SendEmailCommand).rejects(namedError("Whatever", 503));
    expect(
      ((await sendSesEmail(message, "set").catch((e: unknown) => e)) as ExternalServiceError)
        .retryable,
    ).toBe(true);

    sesMock.on(SendEmailCommand).rejects(new Error("ECONNRESET"));
    expect(
      ((await sendSesEmail(message, "set").catch((e: unknown) => e)) as ExternalServiceError)
        .retryable,
    ).toBe(true);
  });

  it.each(["MessageRejected", "MailFromDomainNotVerifiedException", "AccessDeniedException"])(
    "fails fast on %s",
    async (name) => {
      sesMock.on(SendEmailCommand).rejects(namedError(name, 400));

      const error = await sendSesEmail(message, "set").catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ExternalServiceError);
      expect((error as ExternalServiceError).retryable).toBe(false);
    },
  );

  it("does not retry a response without a MessageId", async () => {
    sesMock.on(SendEmailCommand).resolves({});

    const error = await sendSesEmail(message, "set").catch((e: unknown) => e);

    expect((error as ExternalServiceError).retryable).toBe(false);
  });

  it("raises a retryable TimeoutError when SES does not answer in time", async () => {
    vi.useFakeTimers();
    // Reject on abort, as the real SDK does with the signal it is given.
    sesMock.restore();
    vi.spyOn(SESv2Client.prototype, "send").mockImplementation(
      ((_command: unknown, options?: { abortSignal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options?.abortSignal?.addEventListener("abort", () => reject(namedError("AbortError")));
        })) as never,
    );

    const pending = sendSesEmail(message, "set").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    const error = await pending;

    expect(error).toBeInstanceOf(TimeoutError);
    expect((error as TimeoutError).retryable).toBe(true);
    vi.restoreAllMocks();
  });

  describe("header-injection guard", () => {
    it.each([
      ["subject", { subject: "Hi\r\nBcc: evil@example.com" }],
      ["from", { from: "a@peptologics.com\nBcc: evil@example.com" }],
      ["to", { to: ["hello@peptologics.com\r\nBcc: evil@example.com"] }],
      ["reply-to", { replyTo: "x@example.com\nBcc: evil@example.com" }],
    ])("rejects CR/LF in %s without calling SES", async (_field, override) => {
      sesMock.on(SendEmailCommand).resolves({ MessageId: "should-not-send" });

      const error = await sendSesEmail({ ...message, ...override }, "set").catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ExternalServiceError);
      expect((error as ExternalServiceError).retryable).toBe(false);
      expect(sesMock.commandCalls(SendEmailCommand)).toHaveLength(0);
    });
  });
});

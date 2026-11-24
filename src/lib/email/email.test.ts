import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseRecipients, sendEmail, type EmailMessage } from "@/lib/email";

const mocks = vi.hoisted(() => ({
  env: {
    INQUIRY_EMAIL_PROVIDER: "resend" as "resend" | "ses",
    INQUIRY_SES_CONFIGURATION_SET: "peptologics-prod" as string | undefined,
    RESEND_API_KEY: "re_key" as string | undefined,
  },
  sendResendEmail: vi.fn(),
  sendSesEmail: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("@/lib/resend", () => ({ sendResendEmail: mocks.sendResendEmail }));
vi.mock("@/lib/ses", () => ({ sendSesEmail: mocks.sendSesEmail }));

const message: EmailMessage = {
  from: "a@peptologics.com",
  to: ["b@peptologics.com"],
  subject: "s",
  text: "t",
  html: "<p>t</p>",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.INQUIRY_EMAIL_PROVIDER = "resend";
});

describe("sendEmail provider switch", () => {
  it("uses Resend by default", async () => {
    mocks.sendResendEmail.mockResolvedValue({ id: "re-1" });

    await expect(sendEmail(message)).resolves.toEqual({ id: "re-1" });
    expect(mocks.sendResendEmail).toHaveBeenCalledWith(message, "re_key");
    expect(mocks.sendSesEmail).not.toHaveBeenCalled();
  });

  it("uses SES with the configuration set when the provider is ses", async () => {
    mocks.env.INQUIRY_EMAIL_PROVIDER = "ses";
    mocks.sendSesEmail.mockResolvedValue({ id: "ses-1" });

    await expect(sendEmail(message)).resolves.toEqual({ id: "ses-1" });
    expect(mocks.sendSesEmail).toHaveBeenCalledWith(message, "peptologics-prod");
    expect(mocks.sendResendEmail).not.toHaveBeenCalled();
  });

  it("does not fall back to Resend when SES fails", async () => {
    mocks.env.INQUIRY_EMAIL_PROVIDER = "ses";
    mocks.sendSesEmail.mockRejectedValue(new Error("rejected"));

    await expect(sendEmail(message)).rejects.toThrow("rejected");
    expect(mocks.sendResendEmail).not.toHaveBeenCalled();
  });
});

describe("parseRecipients", () => {
  it("splits, trims and drops empties", () => {
    expect(parseRecipients(" a@x.com, ,b@x.com ,")).toEqual(["a@x.com", "b@x.com"]);
  });
});

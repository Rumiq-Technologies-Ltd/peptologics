import "server-only";

import { env } from "@/lib/env";
import { sendResendEmail } from "@/lib/resend";
import { sendSesEmail } from "@/lib/ses";

/**
 * Provider-neutral email transport (ADR-037).
 *
 * `INQUIRY_EMAIL_PROVIDER` picks the provider; unset means `resend`, so shipping this code
 * changes nothing until the variable is set. There is deliberately no fallback from one
 * provider to the other inside a send: two providers per message makes a failure hard to
 * trace. Rollback is flipping the variable back and rebuilding.
 */

export interface EmailMessage {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

export interface EmailSendResult {
  /** The provider's message id, stored on `notification_log`. */
  id: string;
}

export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  if (env.INQUIRY_EMAIL_PROVIDER === "ses") {
    return sendSesEmail(message, env.INQUIRY_SES_CONFIGURATION_SET);
  }

  return sendResendEmail(message, env.RESEND_API_KEY ?? "");
}

/** Splits the comma-separated recipient list from the environment. */
export function parseRecipients(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

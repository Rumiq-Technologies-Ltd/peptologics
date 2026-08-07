import "server-only";

import { EMAIL_TIMEOUT_MS } from "@/constants/business";
import { ExternalServiceError } from "@/lib/errors";
import { withTimeout } from "@/lib/resilience";

/**
 * Resend adapter, over `fetch`.
 *
 * The official SDK is not used deliberately. Sending one transactional email is a
 * single POST with a JSON body; wrapping that costs a dependency, its transitive
 * tree and its bundle weight in every serverless function that touches the inquiry
 * path, in exchange for nothing this file does not already do. If Resend gains a
 * feature worth the SDK — batching, webhooks with signature verification — this is
 * the one module that changes.
 *
 * Nothing here decides *whether* to send, or what the message says. It transports.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface ResendMessage {
  /** Must be on a Resend-verified sending domain. */
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  /** Set to the customer's address so a representative can simply hit reply. */
  replyTo?: string;
}

export interface ResendSendResult {
  /** Provider message id, stored for support tickets. */
  id: string;
}

/**
 * Sends one email and returns its provider id.
 *
 * Bounded by `EMAIL_TIMEOUT_MS` through a real `AbortSignal`, so a hanging provider
 * cannot hold a serverless invocation open until the platform kills it. Throws
 * `ExternalServiceError`, which classifies 408/429/5xx as retryable and everything
 * else as final — a 401 from a wrong API key will never succeed on a second attempt,
 * and retrying it only delays the dead-letter record the operator needs.
 */
export async function sendResendEmail(
  message: ResendMessage,
  apiKey: string,
): Promise<ResendSendResult> {
  const response = await withTimeout(
    (signal) =>
      fetch(RESEND_ENDPOINT, {
        method: "POST",
        signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: message.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        }),
      }),
    EMAIL_TIMEOUT_MS,
    "resend.send",
  );

  if (!response.ok) {
    throw await ExternalServiceError.fromResponse("Resend", response);
  }

  const payload: unknown = await response.json().catch(() => null);

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof (payload as { id?: unknown }).id !== "string"
  ) {
    // A 2xx with an unrecognisable body means the message may well have been
    // accepted, so this is not retryable — a retry risks a duplicate email.
    throw new ExternalServiceError("Resend", "Accepted the request but returned no message id", {
      retryable: false,
    });
  }

  return { id: (payload as { id: string }).id };
}

/**
 * Splits the comma-separated recipient list from the environment.
 *
 * Kept here rather than in the service so the parsing rule lives beside the
 * transport that consumes it.
 */
export function parseRecipients(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

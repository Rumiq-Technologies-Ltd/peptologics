import "server-only";

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

import { EMAIL_TIMEOUT_MS } from "@/constants/business";
import { awsClientDefaults } from "@/lib/aws/config";
import { ExternalServiceError, TimeoutError } from "@/lib/errors";
import { withTimeout } from "@/lib/resilience";

/**
 * Amazon SES v2 adapter. Transport only: it decides neither whether to send nor what the
 * message says (see `src/services/email.service.ts` and the templates).
 */

const SERVICE_NAME = "SES";
const CONTROL_CHARACTERS = /[\r\n]/;

export interface SesMessage {
  /** Must be on the SES-verified domain. */
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  /** Set so a representative can simply hit reply. */
  replyTo?: string;
}

export interface SesSendResult {
  /** SES MessageId, matched later against delivery and bounce events. */
  id: string;
}

/** SES error names that will never succeed on a second attempt. */
const NON_RETRYABLE_ERRORS: ReadonlySet<string> = new Set([
  "MessageRejected",
  "MailFromDomainNotVerifiedException",
  "AccountSuspendedException",
  "SendingPausedException",
  "BadRequestException",
  "NotFoundException",
  "AccessDeniedException",
  "UnrecognizedClientException",
  "ValidationException",
  "InvalidParameterValue",
]);

/** SES error names worth another attempt. */
const RETRYABLE_ERRORS: ReadonlySet<string> = new Set([
  "TooManyRequestsException",
  "ThrottlingException",
  "LimitExceededException",
  "InternalServiceErrorException",
  "ServiceUnavailable",
  "TimeoutError",
  "RequestTimeout",
]);

let cachedClient: SESv2Client | undefined;

function getClient(): SESv2Client {
  cachedClient ??= new SESv2Client(awsClientDefaults);
  return cachedClient;
}

/**
 * Rejects CR/LF in any header-bound field. SES builds the MIME itself, so this is
 * defence in depth, not the only barrier. Rejecting (not stripping) means a tampered
 * value is never silently "repaired" into a different address.
 */
function assertNoHeaderInjection(message: SesMessage): void {
  const fields = [message.subject, message.from, ...message.to, message.replyTo ?? ""];

  if (fields.some((field) => CONTROL_CHARACTERS.test(field))) {
    throw new ExternalServiceError(SERVICE_NAME, "Refused a header field containing CR or LF", {
      retryable: false,
    });
  }
}

function toExternalServiceError(error: unknown): ExternalServiceError {
  if (error instanceof ExternalServiceError) return error;

  const err = error as {
    name?: string;
    message?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const name = err?.name ?? "UnknownError";
  const status = err?.$metadata?.httpStatusCode;
  const message = `${name}${err?.message ? `: ${err.message}`.slice(0, 300) : ""}`;

  let retryable: boolean;
  if (NON_RETRYABLE_ERRORS.has(name)) retryable = false;
  else if (RETRYABLE_ERRORS.has(name)) retryable = true;
  else if (status !== undefined) retryable = status === 408 || status === 429 || status >= 500;
  // No HTTP status: a network-level failure (reset, DNS), which is transient.
  else retryable = true;

  return new ExternalServiceError(SERVICE_NAME, message, { status, retryable, cause: error });
}

/**
 * Sends one email and returns its SES MessageId.
 *
 * Bounded by `EMAIL_TIMEOUT_MS`. Retrying after a timeout or network error can produce a
 * duplicate, because SES may have accepted the first attempt; that is deliberate (ADR-037).
 */
export async function sendSesEmail(
  message: SesMessage,
  configurationSetName: string | undefined,
): Promise<SesSendResult> {
  assertNoHeaderInjection(message);

  try {
    const response = await withTimeout(
      (signal) =>
        getClient().send(
          new SendEmailCommand({
            FromEmailAddress: message.from,
            Destination: { ToAddresses: message.to },
            ReplyToAddresses: message.replyTo ? [message.replyTo] : undefined,
            ConfigurationSetName: configurationSetName,
            Content: {
              Simple: {
                Subject: { Data: message.subject, Charset: "UTF-8" },
                Body: {
                  Text: { Data: message.text, Charset: "UTF-8" },
                  Html: { Data: message.html, Charset: "UTF-8" },
                },
              },
            },
          }),
          { abortSignal: signal },
        ),
      EMAIL_TIMEOUT_MS,
      "ses.send",
    );

    if (!response.MessageId) {
      // Possibly accepted, so not retryable: a retry risks a duplicate for no gain.
      throw new ExternalServiceError(
        SERVICE_NAME,
        "Accepted the request but returned no MessageId",
        {
          retryable: false,
        },
      );
    }

    return { id: response.MessageId };
  } catch (error) {
    // TimeoutError from withTimeout is already retryable and carries its own type.
    if (error instanceof TimeoutError) throw error;
    throw toExternalServiceError(error);
  }
}

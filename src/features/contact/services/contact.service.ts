import "server-only";

import { MIN_FORM_DWELL_SECONDS } from "@/constants/business";
import { MESSAGES } from "@/constants/messages";
import { buildCompanyMessageEmail } from "@/features/contact/templates/companyMessage";
import { buildVisitorConfirmationEmail } from "@/features/contact/templates/visitorConfirmation";
import type { RateLimitService } from "@/features/inquiry/services/rate-limit.service";
import type { EmailMessage, EmailSendResult } from "@/lib/email";
import { logger } from "@/lib/logger";
import type { ContactRequest } from "@/lib/validations/contact.schema";
import { fail, ok, type ServiceResult } from "@/types/result";

/**
 * The contact-form flow: two emails, nothing stored (D33).
 *
 * ```
 * spam filters  →  rate limit  →  email to the company  →  confirmation to the visitor
 * ```
 *
 * Same shape as `InquiryService` minus the database, so a bot costs nothing and the rate
 * limit runs before any email is sent.
 *
 * **There is no copy of the message anywhere but the company's inbox.** That is why the
 * company email goes first and its failure is the only failure the visitor sees: if it did
 * not send, the message has gone nowhere, and saying "sent" would lose it silently. The
 * confirmation is a courtesy; if only it fails the message *was* delivered, so the visitor
 * gets success and the failure is logged.
 *
 * Returns `ServiceResult` rather than throwing, like every service here. Retries live in
 * `sendMessage`, which the container wires to the shared `withRetry`.
 */

export interface ContactResult {
  /** Always true. Present so the success envelope carries a `data` object like every other. */
  received: true;
}

export interface ContactSubmitContext {
  /** Salted hash of the client IP. Never a raw address. */
  clientKey: string;
}

/** What the service needs from the environment, passed in rather than imported. */
export interface ContactEmailConfig {
  /** False when the provider credentials, sender or recipients are missing. */
  configured: boolean;
  /** `INQUIRY_NOTIFICATION_FROM`. */
  companyFrom: string;
  /** `INQUIRY_NOTIFICATION_TO`, already split into addresses. */
  companyTo: string[];
  /** `CUSTOMER_CONFIRMATION_FROM`, already resolved with its fallback. */
  visitorFrom: string;
}

export interface ContactServiceDeps {
  rateLimit: Pick<RateLimitService, "checkContact">;
  /** Sends one message with the shared timeout and retry behaviour. Throws when it gives up. */
  sendMessage: (message: EmailMessage) => Promise<EmailSendResult>;
  config: ContactEmailConfig;
}

export interface ContactService {
  submit(
    input: ContactRequest,
    context: ContactSubmitContext,
  ): Promise<ServiceResult<ContactResult>>;
}

/**
 * What a suppressed submission receives: identical to a real success, so a bot learns
 * nothing about which signal caught it.
 */
const RECEIVED: ContactResult = { received: true };

/** The reason this submission looks like a bot, or `null` when it does not. */
function suppressionReason(input: ContactRequest): string | null {
  // Hidden from people, visible to anything that fills every input it finds.
  if (input.honeypot && input.honeypot.trim().length > 0) return "honeypot";

  // Our form always sends the elapsed time, so an absent value is not our form. Treated as
  // a failed check: omitting a field must not be easier than forging it.
  if (input.formElapsedMs === undefined) return "dwell_missing";

  if (input.formElapsedMs < MIN_FORM_DWELL_SECONDS * 1000) return "dwell_too_short";

  return null;
}

export function createContactService({
  rateLimit,
  sendMessage,
  config,
}: ContactServiceDeps): ContactService {
  async function sendToCompany(input: ContactRequest, recipients: string[]): Promise<boolean> {
    const content = buildCompanyMessageEmail(input);

    try {
      const result = await sendMessage({
        from: config.companyFrom,
        to: recipients,
        subject: content.subject,
        text: content.text,
        html: content.html,
        // Whoever answers replies to the visitor, not to the sending mailbox. Safe to
        // interpolate: the address passed `z.email` after whitespace was collapsed, so it
        // cannot carry the CR or LF that would inject a header.
        replyTo: input.email,
      });

      logger.info("contact_email_sent", { providerMessageId: result.id });
      return true;
    } catch (error) {
      logger.error("contact_email_send_failed", { error });
      return false;
    }
  }

  async function sendConfirmation(
    input: ContactRequest,
    replyTo: string | undefined,
  ): Promise<void> {
    const content = buildVisitorConfirmationEmail({ replyToAddress: replyTo });

    try {
      const result = await sendMessage({
        from: config.visitorFrom,
        to: [input.email],
        subject: content.subject,
        text: content.text,
        html: content.html,
        // Mirror image of the company email: replying reaches the company.
        replyTo: replyTo ?? config.visitorFrom,
      });

      logger.info("contact_confirmation_sent", { providerMessageId: result.id });
    } catch (error) {
      // Invisible to the visitor: their message was delivered, and a worrying error would
      // replace a solved problem with a new one.
      logger.error("contact_confirmation_failed", { error });
    }
  }

  return {
    async submit(input, context): Promise<ServiceResult<ContactResult>> {
      const reason = suppressionReason(input);

      if (reason) {
        // Logged with the reason so a false positive is diagnosable, without visitor data.
        logger.warn("contact_suppressed", { reason });
        return ok(RECEIVED);
      }

      const verdict = await rateLimit.checkContact(context.clientKey);

      if (!verdict.allowed) {
        logger.warn("contact_rate_limited", { hitCount: verdict.hitCount, limit: verdict.limit });

        return fail("RATE_LIMITED", MESSAGES.contact.rateLimited, {
          retryAfterSeconds: verdict.retryAfterSeconds,
        });
      }

      const recipients = config.companyTo;

      if (!config.configured || recipients.length === 0) {
        // Not stored anywhere, so claiming success would lose the message silently.
        logger.error("contact_email_not_configured");
        return fail("UNEXPECTED", MESSAGES.contact.failed);
      }

      if (!(await sendToCompany(input, recipients))) {
        return fail("UNEXPECTED", MESSAGES.contact.failed);
      }

      await sendConfirmation(input, recipients[0]);

      return ok(RECEIVED);
    },
  };
}

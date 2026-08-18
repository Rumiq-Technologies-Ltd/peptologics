import "server-only";

import { NOTIFICATION_RETRY_ATTEMPTS } from "@/constants/business";
import { buildCustomerConfirmationEmail } from "@/features/inquiry/templates/customerConfirmation";
import { buildInternalNotificationEmail } from "@/features/inquiry/templates/internalNotification";
import type { InquiryNotification, NotificationOutcome } from "@/features/inquiry/types/inquiry";
import { customerConfirmationFrom, env, isEmailConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { parseRecipients, sendResendEmail } from "@/lib/resend";
import { withRetry } from "@/lib/resilience";

/**
 * The email channels: the internal notification, and the customer confirmation.
 *
 * Both live in one service because they share every mechanic — the same transport, the
 * same retry budget, the same credential check, the same "never throw" contract. What
 * differs is who reads them, and that difference lives in the templates.
 *
 * Two rules hold here without exception:
 *
 * 1. **It never throws.** Every path returns a `NotificationOutcome`. The order is
 *    already committed by the time this runs, and an exception escaping into the
 *    caller could only ever turn a saved lead into an error page.
 * 2. **Missing credentials are `skipped`, not `failed`.** A deployment without a
 *    verified Resend domain is an expected state, not an incident, and keeping the
 *    two distinct is what stops the dead-letter list filling with noise before the
 *    account exists.
 */

export interface EmailService {
  /** Tells the company a lead arrived. */
  sendInquiryNotification(notification: InquiryNotification): Promise<NotificationOutcome>;
  /** Tells the customer we have their inquiry and when to expect a reply (ADR-027). */
  sendCustomerConfirmation(notification: InquiryNotification): Promise<NotificationOutcome>;
}

/** Technical detail for the operator column. Never rendered to a customer. */
function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createEmailService(): EmailService {
  return {
    async sendInquiryNotification(notification): Promise<NotificationOutcome> {
      if (!isEmailConfigured) {
        logger.warn("email_skipped_not_configured", { orderId: notification.orderId });

        return {
          channel: "email",
          status: "skipped",
          attempts: 0,
          errorMessage: "Resend is not configured (API key, from address or recipients missing).",
        };
      }

      const content = buildInternalNotificationEmail(notification);
      const recipients = parseRecipients(env.INQUIRY_NOTIFICATION_TO ?? "");

      if (recipients.length === 0) {
        return {
          channel: "email",
          status: "skipped",
          attempts: 0,
          errorMessage: "INQUIRY_NOTIFICATION_TO contained no usable address.",
        };
      }

      // Counted here rather than inferred, so the log row records how many calls the
      // provider actually received — the number an operator needs when Resend's own
      // dashboard disagrees with ours.
      let attempts = 0;

      try {
        const result = await withRetry(
          () => {
            attempts += 1;

            return sendResendEmail(
              {
                from: env.INQUIRY_NOTIFICATION_FROM ?? "",
                to: recipients,
                subject: content.subject,
                text: content.text,
                html: content.html,
                // The representative replies to the customer, not to the sending
                // mailbox. Safe to interpolate: the address passed Zod's email
                // check and sanitisation collapsed any whitespace, so it cannot
                // carry a header-injecting newline.
                replyTo: notification.customer.email,
              },
              env.RESEND_API_KEY ?? "",
            );
          },
          { attempts: NOTIFICATION_RETRY_ATTEMPTS, operationName: "resend.send" },
        );

        logger.info("email_sent", {
          orderId: notification.orderId,
          orderNumber: notification.orderNumber,
          providerMessageId: result.id,
          attempts,
        });

        return { channel: "email", status: "sent", providerMessageId: result.id, attempts };
      } catch (error) {
        // Deliberately terminal: the caller records this and moves on. The lead is
        // saved, and the failed row is the operator's cue to follow up manually.
        logger.error("email_send_failed", {
          orderId: notification.orderId,
          orderNumber: notification.orderNumber,
          attempts,
          error,
        });

        return {
          channel: "email",
          status: "failed",
          attempts,
          errorMessage: toErrorMessage(error),
        };
      }
    },

    async sendCustomerConfirmation(notification): Promise<NotificationOutcome> {
      if (!isEmailConfigured) {
        logger.warn("customer_email_skipped_not_configured", { orderId: notification.orderId });

        return {
          channel: "customer_email",
          status: "skipped",
          attempts: 0,
          errorMessage: "Resend is not configured (API key, from address or recipients missing).",
        };
      }

      /*
       * The recipient is the address the visitor typed, which is why it is the one thing
       * here that is not read from the environment. It has been through Zod's email check
       * and the sanitiser, so it cannot carry the newline that would turn an interpolated
       * address into an injected header — but it is still the only place in this file
       * where a stranger chooses who we send to. What bounds the abuse is the inquiry rate
       * limit, not this function.
       */
      const internalRecipients = parseRecipients(env.INQUIRY_NOTIFICATION_TO ?? "");

      const content = buildCustomerConfirmationEmail(notification, {
        // The first internal recipient, named in the body as a second route back to a
        // human. Absent rather than empty when nothing is configured; the template drops
        // the sentence instead of rendering a blank address.
        replyToAddress: internalRecipients[0],
      });

      let attempts = 0;

      try {
        const result = await withRetry(
          () => {
            attempts += 1;

            return sendResendEmail(
              {
                from: customerConfirmationFrom,
                to: [notification.customer.email],
                subject: content.subject,
                text: content.text,
                html: content.html,
                /*
                 * A customer hitting reply must reach the company, not the sending
                 * mailbox — which is the mirror image of the internal notification, where
                 * reply-to is the customer. Falls back to the from address when no
                 * internal recipient is configured, so reply always goes somewhere real.
                 */
                replyTo: internalRecipients[0] ?? customerConfirmationFrom,
              },
              env.RESEND_API_KEY ?? "",
            );
          },
          {
            attempts: NOTIFICATION_RETRY_ATTEMPTS,
            operationName: "resend.sendCustomerConfirmation",
          },
        );

        logger.info("customer_email_sent", {
          orderId: notification.orderId,
          orderNumber: notification.orderNumber,
          providerMessageId: result.id,
          attempts,
        });

        return {
          channel: "customer_email",
          status: "sent",
          providerMessageId: result.id,
          attempts,
        };
      } catch (error) {
        /*
         * Terminal, and deliberately invisible to the customer. They have already been
         * shown the success page, and the lead is saved — telling them the confirmation
         * failed would replace a solved problem with a worrying one. The `failed` row is
         * the operator's cue that this customer has no written record and may need one.
         */
        logger.error("customer_email_send_failed", {
          orderId: notification.orderId,
          orderNumber: notification.orderNumber,
          attempts,
          error,
        });

        return {
          channel: "customer_email",
          status: "failed",
          attempts,
          errorMessage: toErrorMessage(error),
        };
      }
    },
  };
}

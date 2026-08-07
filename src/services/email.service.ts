import "server-only";

import { NOTIFICATION_RETRY_ATTEMPTS } from "@/constants/business";
import { buildInternalNotificationEmail } from "@/features/inquiry/templates/internalNotification";
import type { InquiryNotification, NotificationOutcome } from "@/features/inquiry/types/inquiry";
import { env, isEmailConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { parseRecipients, sendResendEmail } from "@/lib/resend";
import { withRetry } from "@/lib/resilience";

/**
 * The email channel.
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
  sendInquiryNotification(notification: InquiryNotification): Promise<NotificationOutcome>;
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
  };
}

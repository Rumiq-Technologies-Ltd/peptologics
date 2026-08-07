import "server-only";

import type { InquiryNotification, NotificationOutcome } from "@/features/inquiry/types/inquiry";
import { logger } from "@/lib/logger";
import type { EmailService } from "@/services/email.service";
import type { NotificationRepository } from "@/services/notification.repository";

/**
 * Fans an inquiry out to every notification channel.
 *
 * The contract this service exists to enforce: **it cannot throw.** Dispatch runs
 * after the order is committed, so an exception here could only turn a saved lead
 * into an error page for the customer — the worst possible trade. Every channel's
 * result, including a crash inside a channel, becomes a row in `notification_log`.
 *
 * Channels are independent. Email failing must not stop WhatsApp, which is why they
 * run through `allSettled` rather than `all` and why each records its own outcome.
 *
 * The rows already exist as `pending`, written inside the order's transaction by
 * `create_inquiry`. That ordering is what makes the table a reliable dead-letter
 * list: if this process dies before dispatch, the pending rows remain and the
 * operator can see exactly which leads nobody was told about.
 */

/**
 * The WhatsApp channel, as this service needs to see it.
 *
 * Declared here and left unimplemented until Phase 6 (ADR-007). Passing `undefined`
 * is a supported state, not a gap: the channel records `skipped` and the flow is
 * unaffected, which is exactly what a deployment without Meta credentials should do.
 */
export interface WhatsAppService {
  sendInquiryNotification(notification: InquiryNotification): Promise<NotificationOutcome>;
}

export interface NotificationService {
  /** Dispatches every channel and records each outcome. Resolves, never rejects. */
  dispatch(notification: InquiryNotification): Promise<NotificationOutcome[]>;
}

export interface NotificationServiceDeps {
  email: EmailService;
  repository: NotificationRepository;
  whatsApp?: WhatsAppService;
}

export function createNotificationService({
  email,
  repository,
  whatsApp,
}: NotificationServiceDeps): NotificationService {
  /**
   * Runs one channel and turns any escape into a `failed` outcome.
   *
   * The channel services are written not to throw, but "written not to" is not the
   * same as "cannot", and this is the last place where a bug in one of them could
   * still reach the customer.
   */
  async function runChannel(
    channel: NotificationOutcome["channel"],
    send: () => Promise<NotificationOutcome>,
  ): Promise<NotificationOutcome> {
    try {
      return await send();
    } catch (error) {
      logger.error("notification_channel_threw", { channel, error });

      return {
        channel,
        status: "failed",
        attempts: 1,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /** Persists an outcome. A failed write is logged and swallowed — see above. */
  async function record(orderId: string, outcome: NotificationOutcome): Promise<void> {
    try {
      await repository.recordOutcome(orderId, outcome);
    } catch (error) {
      // The row stays `pending`, which is the correct reading of what happened: we
      // cannot prove the notification landed, so it belongs in the dead-letter list.
      logger.error("notification_log_write_failed", {
        orderId,
        channel: outcome.channel,
        status: outcome.status,
        error,
      });
    }
  }

  return {
    async dispatch(notification): Promise<NotificationOutcome[]> {
      const settled = await Promise.allSettled([
        runChannel("email", () => email.sendInquiryNotification(notification)),

        runChannel("whatsapp", async () => {
          if (!whatsApp) {
            return {
              channel: "whatsapp",
              status: "skipped",
              attempts: 0,
              errorMessage: "WhatsApp Cloud API is not enabled for this deployment.",
            } satisfies NotificationOutcome;
          }

          return whatsApp.sendInquiryNotification(notification);
        }),
      ]);

      const outcomes = settled.map((result, index): NotificationOutcome =>
        result.status === "fulfilled"
          ? result.value
          : {
              // Unreachable in practice — runChannel already catches. Kept because
              // `allSettled` can technically reject a thunk and this must not throw.
              channel: index === 0 ? "email" : "whatsapp",
              status: "failed",
              attempts: 0,
              errorMessage: "Channel rejected without an outcome.",
            },
      );

      for (const outcome of outcomes) {
        await record(notification.orderId, outcome);
      }

      logger.info("notifications_dispatched", {
        orderId: notification.orderId,
        orderNumber: notification.orderNumber,
        outcomes: outcomes.map((outcome) => `${outcome.channel}:${outcome.status}`),
      });

      return outcomes;
    },
  };
}

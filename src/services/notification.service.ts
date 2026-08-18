import "server-only";

import type { InquiryNotification, NotificationOutcome } from "@/features/inquiry/types/inquiry";
import { logger } from "@/lib/logger";
import type { EmailService } from "@/services/email.service";
import type { NotificationRepository } from "@/services/notification.repository";

/**
 * Notifies the company that an inquiry arrived.
 *
 * The contract this service exists to enforce: **it cannot throw.** Dispatch runs
 * after the order is committed, so an exception here could only turn a saved lead
 * into an error page for the customer — the worst possible trade. Every result,
 * including a crash inside a channel, becomes a row in `notification_log`.
 *
 * That row already exists as `pending`, written inside the order's transaction by
 * `create_inquiry`. The ordering is what makes the table a reliable dead-letter list:
 * if this process dies before dispatch, the pending row remains and the operator can
 * see exactly which leads nobody was told about.
 *
 * **Two channels, both over email** (ADR-023, ADR-027): the internal notification that
 * tells the company a lead arrived, and the confirmation that tells the customer we have
 * their inquiry. They run concurrently rather than in sequence — they share nothing, and
 * running them serially would add a second provider round trip, plus its retry budget, to
 * the latency of a request the customer is still waiting on.
 *
 * Concurrency is safe here precisely because of `runChannel`: it cannot reject, so
 * `Promise.all` cannot either, and neither channel can abort the other. The outcomes are
 * then recorded one at a time — the writes are cheap, and ordering them keeps a single
 * failing write from obscuring the other.
 */

export interface NotificationService {
  /** Dispatches every channel and records each outcome. Resolves, never rejects. */
  dispatch(notification: InquiryNotification): Promise<NotificationOutcome[]>;
}

export interface NotificationServiceDeps {
  email: EmailService;
  repository: NotificationRepository;
}

export function createNotificationService({
  email,
  repository,
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
      const outcomes = await Promise.all([
        runChannel("email", () => email.sendInquiryNotification(notification)),
        runChannel("customer_email", () => email.sendCustomerConfirmation(notification)),
      ]);

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

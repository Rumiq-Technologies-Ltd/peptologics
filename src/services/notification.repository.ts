import "server-only";

import type { NotificationOutcome } from "@/features/inquiry/types/inquiry";
import { DatabaseError } from "@/lib/errors";
import { getWriteClient } from "@/lib/supabase/client.server";

/**
 * Database access for the notification delivery record.
 *
 * `create_inquiry` writes one `pending` row per channel inside the order's own
 * transaction, so a channel can never be silently forgotten — even if the process
 * dies before dispatch. This repository only ever *updates* those rows to their
 * final outcome.
 *
 * The partial index on `status in ('pending','failed')` makes the table a
 * replayable dead-letter list: whatever is left in it is a lead nobody was told
 * about.
 */

export interface NotificationRepository {
  recordOutcome(orderId: string, outcome: NotificationOutcome): Promise<void>;
}

export function createNotificationRepository(): NotificationRepository {
  return {
    async recordOutcome(orderId, outcome): Promise<void> {
      const client = getWriteClient();

      const { error } = await client
        .from("notification_log")
        .update({
          status: outcome.status,
          provider_message_id: outcome.providerMessageId ?? null,
          // Truncated to the column's CHECK limit. Provider errors can be long and
          // may echo request content, and this column is operator detail, not a log.
          error_message: outcome.errorMessage?.slice(0, 1000) ?? null,
          attempts: outcome.attempts,
          sent_at: outcome.status === "sent" ? new Date().toISOString() : null,
        })
        .eq("order_id", orderId)
        .eq("channel", outcome.channel);

      if (error) {
        throw new DatabaseError("notificationLog.recordOutcome", error.message, { cause: error });
      }
    },
  };
}

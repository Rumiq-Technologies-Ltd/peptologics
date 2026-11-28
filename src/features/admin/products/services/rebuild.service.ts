import { logger } from "@/lib/logger";

/**
 * Asks Amplify for a new build, because a product page exists only once a build has seen the
 * product (the page has `dynamicParams = false`). Called when a product is created or its slug
 * changes; edits, archive and restore only revalidate.
 *
 * At most one build per `REBUILD_DEBOUNCE_MS`. A request inside the window is not lost: it is
 * recorded as owed, and the next request after the window (or "Publish now" in the product list)
 * starts one build that covers everything created since. A failed call never fails the save.
 *
 * The webhook URL is a secret. It is never logged, and no error message here contains it.
 */

export const REBUILD_DEBOUNCE_MS = 2 * 60 * 1000;
const WEBHOOK_TIMEOUT_MS = 5000;

export type RebuildOutcome =
  /** A build was started. */
  | "triggered"
  /** Inside the window: a build is owed and will start with the next request. */
  | "deferred"
  /** The call failed: a build is owed. The save still succeeded. */
  | "failed"
  /** No webhook is configured (local development). */
  | "skipped";

export interface RebuildState {
  /** ISO timestamp of the last build request, or null if there has been none. */
  lastTriggeredAt: string | null;
  /** True while at least one new page is waiting for a build. */
  pending: boolean;
}

export interface RebuildStore {
  getState(): Promise<RebuildState>;
  /** Atomically takes the right to fire: false when a build was requested after `cutoff`. */
  claim(nowIso: string, cutoffIso: string): Promise<boolean>;
  markPending(): Promise<void>;
  /** Puts the window back after a failed call so the next attempt is not blocked. */
  release(): Promise<void>;
}

export interface RebuildDeps {
  store: RebuildStore;
  hookUrl: string | undefined;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export interface RebuildService {
  request(reason: string): Promise<RebuildOutcome>;
  getState(): Promise<RebuildState>;
}

export function createRebuildService({
  store,
  hookUrl,
  fetchImpl = fetch,
  now = () => new Date(),
}: RebuildDeps): RebuildService {
  return {
    getState: () => store.getState(),

    async request(reason): Promise<RebuildOutcome> {
      if (!hookUrl) {
        logger.info("rebuild_skipped_no_hook", { reason });
        return "skipped";
      }

      const at = now();
      const cutoff = new Date(at.getTime() - REBUILD_DEBOUNCE_MS).toISOString();

      try {
        if (!(await store.claim(at.toISOString(), cutoff))) {
          await store.markPending();
          logger.info("rebuild_deferred", { reason });
          return "deferred";
        }

        const response = await fetchImpl(hookUrl, {
          method: "POST",
          signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        });

        if (!response.ok) throw new Error(`The build hook answered ${response.status}.`);

        logger.info("rebuild_triggered", { reason });
        return "triggered";
      } catch (error) {
        logger.error("rebuild_failed", {
          reason,
          error: error instanceof Error ? error.name : "unknown",
        });

        try {
          await store.markPending();
          await store.release();
        } catch (storeError) {
          logger.error("rebuild_state_write_failed", {
            error: storeError instanceof Error ? storeError.name : "unknown",
          });
        }

        return "failed";
      }
    },
  };
}

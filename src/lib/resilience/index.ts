import { TimeoutError, isRetryable } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Timeout and retry primitives for third-party calls.
 *
 * Every external request must be bounded — an unbounded `fetch` can hold a
 * serverless invocation open until the platform kills it (CLAUDE.md, API).
 */

/**
 * Runs `operation` with an abort deadline. The signal is passed through so the
 * underlying request is genuinely cancelled, not merely abandoned.
 */
export async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  operationName: string,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await operation(controller.signal);
  } catch (error) {
    // A caller-independent abort means our own deadline fired.
    if (controller.signal.aborted) {
      throw new TimeoutError(operationName, timeoutMs, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export interface RetryOptions {
  attempts?: number;
  /** Base delay; grows exponentially and is jittered to avoid thundering herds. */
  baseDelayMs?: number;
  operationName: string;
}

/**
 * Retries only errors that declare themselves retryable — timeouts, 429s and
 * 5xx. A 401 or a validation failure will never succeed on a second attempt, so
 * retrying it just burns invocation time and, for notifications, delays the
 * dead-letter record the operator actually needs.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  { attempts = 3, baseDelayMs = 250, operationName }: RetryOptions,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryable(error) || attempt === attempts) {
        throw error;
      }

      const backoff = baseDelayMs * 2 ** (attempt - 1);
      const jitter = Math.floor(Math.random() * baseDelayMs);
      const delay = backoff + jitter;

      logger.warn("retry_scheduled", {
        operation: operationName,
        attempt,
        attempts,
        delayMs: delay,
        error,
      });

      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

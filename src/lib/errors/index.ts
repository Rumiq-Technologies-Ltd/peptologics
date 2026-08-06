/**
 * Typed error hierarchy.
 *
 * Every error carries a `publicMessage` — what a customer may read — separately
 * from its technical message, which stays in the logs. That split is what stops
 * a Postgres error like `relation "orders" does not exist` from ever reaching a
 * browser (CLAUDE.md, Security).
 */

export abstract class AppError extends Error {
  abstract readonly publicMessage: string;
  /** Whether a caller should retry. Timeouts and 5xx yes; a 401 or 400 never. */
  readonly retryable: boolean = false;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** A repository query failed. Never surfaces its technical detail. */
export class DatabaseError extends AppError {
  readonly publicMessage = "We could not complete that request. Please try again.";
  readonly operation: string;

  constructor(operation: string, message: string, options?: { cause?: unknown }) {
    super(`Database operation "${operation}" failed: ${message}`, options);
    this.operation = operation;
  }
}

/** A third-party API (Resend, Meta) rejected or failed to answer a call. */
export class ExternalServiceError extends AppError {
  readonly publicMessage = "An external service is temporarily unavailable.";
  readonly service: string;
  readonly status?: number;
  override readonly retryable: boolean;

  constructor(
    service: string,
    message: string,
    options?: { status?: number; retryable?: boolean; cause?: unknown },
  ) {
    super(`${service} request failed: ${message}`, { cause: options?.cause });
    this.service = service;
    this.status = options?.status;
    this.retryable = options?.retryable ?? isRetryableStatus(options?.status);
  }

  /**
   * Builds an error from a failed `fetch` Response, reading the body for log
   * detail. The body is deliberately truncated — provider error payloads can be
   * large and may echo request contents.
   */
  static async fromResponse(service: string, response: Response): Promise<ExternalServiceError> {
    let detail = "";
    try {
      detail = (await response.text()).slice(0, 500);
    } catch {
      detail = "<unreadable body>";
    }

    return new ExternalServiceError(service, `HTTP ${response.status} ${detail}`, {
      status: response.status,
    });
  }
}

/** An external call exceeded its deadline. Always retryable. */
export class TimeoutError extends AppError {
  readonly publicMessage = "That request took too long. Please try again.";
  override readonly retryable = true;

  constructor(operation: string, timeoutMs: number, options?: { cause?: unknown }) {
    super(`Operation "${operation}" timed out after ${timeoutMs}ms`, options);
  }
}

/** 429 from Resend/Meta, or 5xx — worth another attempt. 4xx is not. */
function isRetryableStatus(status?: number): boolean {
  if (status === undefined) return false;
  return status === 408 || status === 429 || status >= 500;
}

/** Narrowing helper so callers never have to touch `instanceof` chains. */
export function isRetryable(error: unknown): boolean {
  return error instanceof AppError && error.retryable;
}

/** The only message a user is ever shown for an unrecognised failure. */
export const GENERIC_ERROR_MESSAGE = "Something went wrong on our end. Please try again.";

/** Extracts a customer-safe message from any thrown value. */
export function toPublicMessage(error: unknown): string {
  return error instanceof AppError ? error.publicMessage : GENERIC_ERROR_MESSAGE;
}

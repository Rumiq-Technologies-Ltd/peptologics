/**
 * The service-layer return contract.
 *
 * Repositories **throw** typed errors — a failed query is exceptional.
 * Services **return** a `ServiceResult` — a rejected inquiry is an expected
 * outcome, not a crash. Route Handlers then map the result onto the HTTP
 * envelope in `@/types/api` without ever needing a try/catch of their own.
 */

export type ServiceErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "PRODUCT_UNAVAILABLE"
  | "EMPTY_SELECTION"
  | "PERSISTENCE_FAILED"
  | "UNEXPECTED";

export interface ServiceFailure {
  success: false;
  code: ServiceErrorCode;
  /** Safe to show a customer. Never contains SQL, table names, or stack traces. */
  message: string;
  /** Field-level validation detail, keyed by form field path. */
  fieldErrors?: Record<string, string[]>;
  /** Seconds until the caller may retry. Set on RATE_LIMITED. */
  retryAfterSeconds?: number;
}

export interface ServiceSuccess<T> {
  success: true;
  data: T;
}

export type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;

export function ok<T>(data: T): ServiceSuccess<T> {
  return { success: true, data };
}

export function fail(
  code: ServiceErrorCode,
  message: string,
  extra?: Omit<ServiceFailure, "success" | "code" | "message">,
): ServiceFailure {
  return { success: false, code, message, ...extra };
}

import type { ApiFailure, ApiFieldError, ApiSuccess } from "@/types/api";
import type { ServiceErrorCode, ServiceFailure } from "@/types/result";

/**
 * Route Handler response helpers. Keeping the envelope construction here is what
 * lets every handler stay three lines long: validate, call service, return.
 */

export function jsonOk<T>(data: T, message: string, init?: ResponseInit): Response {
  const body: ApiSuccess<T> = { success: true, message, data };
  return Response.json(body, { status: 200, ...init });
}

export function jsonCreated<T>(data: T, message: string, init?: ResponseInit): Response {
  const body: ApiSuccess<T> = { success: true, message, data };
  return Response.json(body, { status: 201, ...init });
}

export function jsonFail(
  message: string,
  options: { status: number; code: string; errors?: ApiFieldError[]; headers?: HeadersInit },
): Response {
  const body: ApiFailure = {
    success: false,
    message,
    code: options.code,
    ...(options.errors?.length ? { errors: options.errors } : {}),
  };

  return Response.json(body, { status: options.status, headers: options.headers });
}

/** HTTP status for each service failure code. One place, so it stays consistent. */
const STATUS_BY_CODE: Record<ServiceErrorCode, number> = {
  VALIDATION_FAILED: 422,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  PRODUCT_UNAVAILABLE: 409,
  EMPTY_SELECTION: 422,
  PERSISTENCE_FAILED: 500,
  UNEXPECTED: 500,
};

/** Maps a service-layer failure onto an HTTP response, including Retry-After. */
export function jsonFromServiceFailure(failure: ServiceFailure): Response {
  const headers: Record<string, string> = {};

  if (failure.retryAfterSeconds !== undefined) {
    headers["Retry-After"] = String(failure.retryAfterSeconds);
  }

  return jsonFail(failure.message, {
    status: STATUS_BY_CODE[failure.code],
    code: failure.code,
    errors: fieldErrorsToApiErrors(failure.fieldErrors),
    headers,
  });
}

function fieldErrorsToApiErrors(
  fieldErrors: Record<string, string[]> | undefined,
): ApiFieldError[] | undefined {
  if (!fieldErrors) return undefined;

  return Object.entries(fieldErrors).flatMap(([field, messages]) =>
    messages.map((message) => ({ field, message })),
  );
}

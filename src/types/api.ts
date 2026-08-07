/**
 * The HTTP response envelope. Every Route Handler returns one of these shapes —
 * consistency here matters more than any individual field choice (CLAUDE.md).
 */

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiFailure {
  success: false;
  message: string;
  /** Stable machine-readable code. Safe to branch on from the client. */
  code: string;
  errors?: ApiFieldError[];
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

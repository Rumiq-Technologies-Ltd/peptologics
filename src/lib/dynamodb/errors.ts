import { DatabaseError } from "@/lib/errors";

/**
 * Turns anything the SDK throws into the application's `DatabaseError`.
 *
 * The SDK's message can name the table, a key or an index, so it goes into the technical
 * message (logs only) and the original error is kept as the cause. `DatabaseError`'s
 * `publicMessage` is what a customer can ever read.
 */
export function toDatabaseError(operation: string, error: unknown): DatabaseError {
  if (error instanceof DatabaseError) return error;

  const detail =
    error instanceof Error ? `${error.name}: ${error.message}` : "an unknown error occurred";

  return new DatabaseError(operation, detail, { cause: error });
}

/**
 * Structured JSON logger.
 *
 * This module is the single sanctioned `console` boundary in the codebase; the
 * `no-console` rule is switched off for this folder in `eslint.config.mjs`.
 *
 * Vercel parses JSON written to stdout/stderr into queryable log fields, so a
 * ~60-line module gives us structured logging with zero dependencies. pino and
 * winston bring transports and worker threads that are real serverless bundling
 * pain for no gain at this size.
 *
 * Never pass raw PII or secrets. Use the redaction helpers in
 * `@/lib/security/redact` for anything derived from user input.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

interface LogEntry extends LogContext {
  level: LogLevel;
  event: string;
  timestamp: string;
}

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Debug is dropped in production so ordinary traffic does not fill the log. */
const minimumRank: number =
  process.env.NODE_ENV === "production" ? LEVEL_RANK.info : LEVEL_RANK.debug;

/**
 * Errors do not survive `JSON.stringify` — it yields `{}`. Unwrap them into
 * plain fields, and follow `cause` so wrapped errors keep their origin.
 */
function serializeError(error: unknown): LogContext {
  if (error instanceof Error) {
    const serialized: LogContext = {
      errorName: error.name,
      errorMessage: error.message,
    };

    if (process.env.NODE_ENV !== "production" && error.stack) {
      serialized.errorStack = error.stack;
    }

    if (error.cause !== undefined) {
      serialized.errorCause =
        error.cause instanceof Error ? error.cause.message : String(error.cause);
    }

    return serialized;
  }

  return { errorMessage: String(error) };
}

function emit(level: LogLevel, event: string, context: LogContext = {}): void {
  if (LEVEL_RANK[level] < minimumRank) return;

  const { error, ...rest } = context;

  const entry: LogEntry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...rest,
    ...(error !== undefined ? serializeError(error) : {}),
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export interface Logger {
  debug(event: string, context?: LogContext): void;
  info(event: string, context?: LogContext): void;
  warn(event: string, context?: LogContext): void;
  error(event: string, context?: LogContext): void;
  /** Returns a logger that merges `bindings` into every subsequent entry. */
  child(bindings: LogContext): Logger;
}

function createLogger(bindings: LogContext = {}): Logger {
  return {
    debug: (event, context) => emit("debug", event, { ...bindings, ...context }),
    info: (event, context) => emit("info", event, { ...bindings, ...context }),
    warn: (event, context) => emit("warn", event, { ...bindings, ...context }),
    error: (event, context) => emit("error", event, { ...bindings, ...context }),
    child: (extra) => createLogger({ ...bindings, ...extra }),
  };
}

export const logger: Logger = createLogger();

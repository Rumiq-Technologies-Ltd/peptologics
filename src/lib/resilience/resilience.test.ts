import { describe, expect, it, vi } from "vitest";

import { ExternalServiceError, TimeoutError } from "@/lib/errors";
import { withRetry, withTimeout } from "@/lib/resilience";

/**
 * Timeout and retry primitives.
 *
 * The classification is the part worth pinning down. Retrying a 401 cannot succeed and
 * only delays the dead-letter record an operator needs; not retrying a 500 loses a lead
 * to a blip. Both mistakes are invisible until they matter.
 */

describe("withRetry", () => {
  it("returns the first success without retrying", async () => {
    const operation = vi.fn(async () => "ok");

    await expect(withRetry(operation, { operationName: "test" })).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledOnce();
  });

  it("retries a retryable failure and returns the eventual success", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new ExternalServiceError("Resend", "boom", { status: 503 }))
      .mockResolvedValueOnce("recovered");

    await expect(withRetry(operation, { operationName: "test", baseDelayMs: 1 })).resolves.toBe(
      "recovered",
    );
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-retryable failure", async () => {
    // A 401 will never succeed on a second attempt.
    const unauthorised = new ExternalServiceError("Resend", "bad key", { status: 401 });
    const operation = vi.fn().mockRejectedValue(unauthorised);

    await expect(withRetry(operation, { operationName: "test", baseDelayMs: 1 })).rejects.toBe(
      unauthorised,
    );
    expect(operation).toHaveBeenCalledOnce();
  });

  it.each([
    ["408", 408],
    ["429", 429],
    ["500", 500],
    ["503", 503],
  ])("treats HTTP %s as retryable", async (_label, status) => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new ExternalServiceError("Resend", "transient", { status }))
      .mockResolvedValueOnce("ok");

    await expect(withRetry(operation, { operationName: "test", baseDelayMs: 1 })).resolves.toBe(
      "ok",
    );
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["400", 400],
    ["403", 403],
    ["404", 404],
    ["422", 422],
  ])("treats HTTP %s as final", async (_label, status) => {
    const operation = vi
      .fn()
      .mockRejectedValue(new ExternalServiceError("Resend", "client error", { status }));

    await expect(
      withRetry(operation, { operationName: "test", baseDelayMs: 1 }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
    expect(operation).toHaveBeenCalledOnce();
  });

  it("gives up after the attempt budget and rethrows the last error", async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(new ExternalServiceError("Resend", "still down", { status: 500 }));

    await expect(
      withRetry(operation, { operationName: "test", attempts: 3, baseDelayMs: 1 }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("does not retry an ordinary Error, which declares nothing about retryability", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("programmer error"));

    await expect(withRetry(operation, { operationName: "test", baseDelayMs: 1 })).rejects.toThrow(
      "programmer error",
    );
    expect(operation).toHaveBeenCalledOnce();
  });
});

describe("withTimeout", () => {
  it("passes the value through when the operation finishes in time", async () => {
    await expect(withTimeout(async () => "done", 1000, "test")).resolves.toBe("done");
  });

  it("throws a TimeoutError and aborts the signal when the deadline passes", async () => {
    let observed: AbortSignal | undefined;

    const promise = withTimeout(
      (signal) => {
        observed = signal;
        // Never settles on its own: only the deadline can end this.
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")));
        });
      },
      10,
      "slow.operation",
    );

    await expect(promise).rejects.toBeInstanceOf(TimeoutError);
    // A real abort, so the underlying request is cancelled rather than abandoned.
    expect(observed?.aborted).toBe(true);
  });

  it("lets a genuine failure through unchanged rather than reporting a timeout", async () => {
    const failure = new Error("connection refused");

    await expect(
      withTimeout(
        async () => {
          throw failure;
        },
        1000,
        "test",
      ),
    ).rejects.toBe(failure);
  });
});

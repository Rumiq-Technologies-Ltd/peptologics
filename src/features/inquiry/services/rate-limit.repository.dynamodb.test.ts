import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDynamoRateLimitRepository } from "@/features/inquiry/services/rate-limit.repository.dynamodb";
import { DatabaseError } from "@/lib/errors";

vi.mock("@/lib/dynamodb/client.server", async () => {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient: Doc } = await import("@aws-sdk/lib-dynamodb");
  const client = Doc.from(new DynamoDBClient({ region: "us-east-1" }));
  return { getDocumentClient: () => client, getTableName: () => "test-table" };
});

/**
 * One atomic ADD per hit. Correctness comes from the window in the key, so a new window
 * starts a fresh counter without anything being deleted.
 */

const WINDOW_SECONDS = 900;
let dynamo: ReturnType<typeof mockClient>;

beforeEach(() => {
  dynamo = mockClient(DynamoDBDocumentClient);
  vi.useFakeTimers();
});

afterEach(() => {
  dynamo.restore();
  vi.useRealTimers();
});

function keyOfCall(index: number): string {
  return String(dynamo.commandCalls(UpdateCommand)[index]?.args[0].input.Key?.PK);
}

describe("createDynamoRateLimitRepository.hit", () => {
  it("allows hits up to the limit and refuses the next one", async () => {
    vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));
    const repository = createDynamoRateLimitRepository();

    dynamo.on(UpdateCommand).resolves({ Attributes: { hits: 5 } });
    await expect(repository.hit("bucket", 5, WINDOW_SECONDS)).resolves.toMatchObject({
      allowed: true,
      hitCount: 5,
      limit: 5,
    });

    dynamo.on(UpdateCommand).resolves({ Attributes: { hits: 6 } });
    await expect(repository.hit("bucket", 5, WINDOW_SECONDS)).resolves.toMatchObject({
      allowed: false,
      hitCount: 6,
    });
  });

  it("reports the seconds left in the window, never zero", async () => {
    // 100 seconds into a 900-second window.
    vi.setSystemTime(new Date("2026-11-24T10:01:40Z"));
    dynamo.on(UpdateCommand).resolves({ Attributes: { hits: 1 } });

    const verdict = await createDynamoRateLimitRepository().hit("b", 5, WINDOW_SECONDS);

    // Window boundaries are multiples of 900s since the epoch: 10:00:00 + 15m = 10:15:00.
    expect(verdict.retryAfterSeconds).toBe(800);

    vi.setSystemTime(new Date("2026-11-24T10:14:59.999Z"));
    const last = await createDynamoRateLimitRepository().hit("b", 5, WINDOW_SECONDS);
    expect(last.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("uses a different item once the window rolls over", async () => {
    dynamo.on(UpdateCommand).resolves({ Attributes: { hits: 1 } });
    const repository = createDynamoRateLimitRepository();

    vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));
    await repository.hit("bucket", 5, WINDOW_SECONDS);
    vi.setSystemTime(new Date("2026-11-24T10:05:00Z"));
    await repository.hit("bucket", 5, WINDOW_SECONDS);
    vi.setSystemTime(new Date("2026-11-24T10:15:00Z"));
    await repository.hit("bucket", 5, WINDOW_SECONDS);

    expect(keyOfCall(0)).toBe(keyOfCall(1));
    expect(keyOfCall(2)).not.toBe(keyOfCall(0));
  });

  it("sets the TTL attribute after the window closes", async () => {
    vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));
    dynamo.on(UpdateCommand).resolves({ Attributes: { hits: 1 } });

    await createDynamoRateLimitRepository().hit("b", 5, WINDOW_SECONDS);

    const values = dynamo.commandCalls(UpdateCommand)[0]?.args[0].input.ExpressionAttributeValues;
    const windowEnd =
      Math.floor(Date.now() / 1000 / WINDOW_SECONDS) * WINDOW_SECONDS + WINDOW_SECONDS;
    expect(values?.[":expires"]).toBeGreaterThan(windowEnd);
  });

  it("fails with a DatabaseError when the table errors or returns no count", async () => {
    vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));
    const repository = createDynamoRateLimitRepository();

    dynamo.on(UpdateCommand).rejects(new Error("throttled"));
    await expect(repository.hit("b", 5, WINDOW_SECONDS)).rejects.toBeInstanceOf(DatabaseError);

    dynamo.on(UpdateCommand).resolves({ Attributes: {} });
    await expect(repository.hit("b", 5, WINDOW_SECONDS)).rejects.toBeInstanceOf(DatabaseError);
  });
});

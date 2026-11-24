import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { validPayload } from "@/features/inquiry/services/order.fixtures";
import { createDynamoOrderRepository } from "@/features/inquiry/services/order.repository.dynamodb";
import { DatabaseError } from "@/lib/errors";

vi.mock("@/lib/dynamodb/client.server", async () => {
  const { DynamoDBClient: Base } = await import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient: Doc } = await import("@aws-sdk/lib-dynamodb");
  const client = Doc.from(new Base({ region: "us-east-1" }));
  return { getDocumentClient: () => client, getTableName: () => "test-table" };
});

/**
 * The write path. What matters: one transaction carries the guard, the order, every line and
 * both pending notifications; a replay writes nothing; a concurrent duplicate returns the
 * winner instead of failing; and the counter starts so a fresh table issues PL-001000.
 */

let dynamo: ReturnType<typeof mockClient>;

beforeEach(() => {
  dynamo = mockClient(DynamoDBDocumentClient);
});

afterEach(() => {
  dynamo.restore();
});

describe("createDynamoOrderRepository.create", () => {
  it("writes guard, order, lines and both notifications in one transaction", async () => {
    dynamo.on(GetCommand).resolves({});
    dynamo.on(UpdateCommand).resolves({ Attributes: { seq: 1000 } });
    dynamo.on(TransactWriteCommand).resolves({});

    const receipt = await createDynamoOrderRepository().create(validPayload());

    expect(receipt).toMatchObject({ orderNumber: "PL-001000", created: true });

    const counter = dynamo.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(counter?.UpdateExpression).toBe("SET seq = if_not_exists(seq, :start) + :one");
    expect(counter?.ExpressionAttributeValues).toEqual({ ":start": 999, ":one": 1 });

    const writes = dynamo.commandCalls(TransactWriteCommand);
    expect(writes).toHaveLength(1);

    const puts = writes[0]?.args[0].input.TransactItems?.map((entry) => entry.Put);
    // 1 guard + 1 order + 1 line + 2 notifications
    expect(puts).toHaveLength(5);
    expect(puts?.[0]?.Item).toMatchObject({ SK: "GUARD", order_number: "PL-001000" });
    expect(puts?.every((put) => put?.ConditionExpression === "attribute_not_exists(PK)")).toBe(
      true,
    );

    const sortKeys = puts?.map((put) => put?.Item?.SK);
    expect(sortKeys).toEqual(
      expect.arrayContaining(["META", "NOTIF#email", "NOTIF#customer_email"]),
    );
    expect(sortKeys?.filter((key) => String(key).startsWith("ITEM#"))).toHaveLength(1);

    const notifications = puts?.filter((put) => String(put?.Item?.SK).startsWith("NOTIF#"));
    expect(notifications?.every((put) => put?.Item?.status === "pending")).toBe(true);
    expect(notifications?.every((put) => put?.Item?.GSI3PK === "NOTIF_OPEN")).toBe(true);
  });

  it("returns the original order and writes nothing when the key was already used", async () => {
    dynamo.on(GetCommand).resolves({
      Item: { order_id: "existing-id", order_number: "PL-001007" },
    });

    const receipt = await createDynamoOrderRepository().create(validPayload());

    expect(receipt).toEqual({ orderId: "existing-id", orderNumber: "PL-001007", created: false });
    expect(dynamo.commandCalls(UpdateCommand)).toHaveLength(0);
    expect(dynamo.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });

  it("returns the winner when a concurrent duplicate commits first", async () => {
    dynamo
      .on(GetCommand)
      .resolvesOnce({})
      .resolves({ Item: { order_id: "winner-id", order_number: "PL-001001" } });
    dynamo.on(UpdateCommand).resolves({ Attributes: { seq: 1002 } });
    dynamo.on(TransactWriteCommand).rejects(
      new TransactionCanceledException({
        message: "cancelled",
        $metadata: {},
        CancellationReasons: [{ Code: "ConditionalCheckFailed" }, { Code: "None" }],
      }),
    );

    const receipt = await createDynamoOrderRepository().create(validPayload());

    expect(receipt).toEqual({ orderId: "winner-id", orderNumber: "PL-001001", created: false });
  });

  it("fails with a DatabaseError when the transaction is cancelled for any other reason", async () => {
    dynamo.on(GetCommand).resolves({});
    dynamo.on(UpdateCommand).resolves({ Attributes: { seq: 1000 } });
    dynamo.on(TransactWriteCommand).rejects(
      new TransactionCanceledException({
        message: "cancelled",
        $metadata: {},
        CancellationReasons: [{ Code: "None" }, { Code: "ConditionalCheckFailed" }],
      }),
    );

    await expect(createDynamoOrderRepository().create(validPayload())).rejects.toBeInstanceOf(
      DatabaseError,
    );
  });

  it("refuses to write an order that breaks an old CHECK rule, before touching the table", async () => {
    const payload = validPayload({ subtotalCents: 1 });

    await expect(createDynamoOrderRepository().create(payload)).rejects.toThrow(
      /orders_subtotal_matches_items/,
    );
    expect(dynamo.calls()).toHaveLength(0);
  });

  it("wraps SDK failures so table details never reach the caller's message", async () => {
    dynamo.on(GetCommand).rejects(new Error("Requested resource not found: peptologics-prod"));

    const error = await createDynamoOrderRepository()
      .create(validPayload())
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DatabaseError);
    expect((error as DatabaseError).publicMessage).not.toMatch(/peptologics/);
  });
});

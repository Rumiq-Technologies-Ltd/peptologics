import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrderWriteConflict } from "@/features/admin/orders/services/orderAdmin.repository";
import { createDynamoOrderAdminRepository } from "@/features/admin/orders/services/orderAdmin.repository.dynamodb";

vi.mock("@/lib/dynamodb/client.server", async () => {
  const { DynamoDBClient: Base } = await import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient: Doc } = await import("@aws-sdk/lib-dynamodb");
  const client = Doc.from(new Base({ region: "us-east-1" }));
  return { getDocumentClient: () => client, getTableName: () => "test-table" };
});

/** Every read is a Query on a key or an index (never a Scan), and writes are one transaction. */

let dynamo: ReturnType<typeof mockClient>;

beforeEach(() => {
  dynamo = mockClient(DynamoDBDocumentClient);
});

afterEach(() => {
  dynamo.restore();
});

describe("reads", () => {
  it("lists a month from GSI1, newest first, following pages, with no Scan", async () => {
    dynamo
      .on(QueryCommand)
      .resolvesOnce({ Items: [{ id: "a" }], LastEvaluatedKey: { PK: "x" } })
      .resolvesOnce({ Items: [{ id: "b" }] });

    const items = await createDynamoOrderAdminRepository().listMonth("2026-11");

    expect(items.map((item) => item.id)).toEqual(["a", "b"]);
    const input = dynamo.commandCalls(QueryCommand)[0]?.args[0].input;
    expect(input).toMatchObject({
      IndexName: "GSI1",
      ScanIndexForward: false,
      ExpressionAttributeValues: { ":pk": "ORDERS#2026-11" },
    });
    expect(dynamo.commandCalls(ScanCommand)).toHaveLength(0);
  });

  it("reads open notifications from the sparse GSI3 partition", async () => {
    dynamo.on(QueryCommand).resolves({ Items: [] });

    await createDynamoOrderAdminRepository().listOpenNotifications();

    expect(dynamo.commandCalls(QueryCommand)[0]?.args[0].input).toMatchObject({
      IndexName: "GSI3",
      ExpressionAttributeValues: { ":pk": "NOTIF_OPEN" },
    });
  });

  it("finds an order by number through GSI2", async () => {
    dynamo.on(QueryCommand).resolves({ Items: [{ id: "a", order_number: "PL-001032" }] });

    const item = await createDynamoOrderAdminRepository().findOrderByNumber("PL-001032");

    expect(item?.id).toBe("a");
    expect(dynamo.commandCalls(QueryCommand)[0]?.args[0].input).toMatchObject({
      IndexName: "GSI2",
      ExpressionAttributeValues: { ":pk": "ORDERNO#PL-001032" },
    });
  });

  it("returns null when no order has that number", async () => {
    dynamo.on(QueryCommand).resolves({ Items: [] });
    expect(await createDynamoOrderAdminRepository().findOrderByNumber("PL-009999")).toBeNull();
  });

  it("reads an order's whole partition in one Query", async () => {
    dynamo.on(QueryCommand).resolves({ Items: [{ SK: "META" }, { SK: "ITEM#p" }] });

    const items = await createDynamoOrderAdminRepository().getOrderPartition("abc");

    expect(items).toHaveLength(2);
    expect(dynamo.commandCalls(QueryCommand)[0]?.args[0].input).toMatchObject({
      ExpressionAttributeValues: { ":pk": "ORDER#abc" },
    });
  });

  it("counts new, visible orders of a month with a COUNT query over all pages", async () => {
    dynamo
      .on(QueryCommand)
      .resolvesOnce({ Count: 2, LastEvaluatedKey: { PK: "x" } })
      .resolvesOnce({ Count: 3 });

    expect(await createDynamoOrderAdminRepository().countNewInMonth("2026-11")).toBe(5);
    expect(dynamo.commandCalls(QueryCommand)[0]?.args[0].input).toMatchObject({
      Select: "COUNT",
      IndexName: "GSI1",
      ExpressionAttributeValues: { ":pk": "ORDERS#2026-11", ":new": "new" },
    });
  });

  it("reads one order item with GetItem", async () => {
    dynamo.on(GetCommand).resolves({ Item: { id: "a" } });
    expect((await createDynamoOrderAdminRepository().getOrderItem("a"))?.id).toBe("a");
  });
});

describe("commit", () => {
  const steps = [
    {
      kind: "update" as const,
      key: { PK: "ORDER#a", SK: "META" },
      update: "SET #v = :next",
      names: { "#v": "version" },
      values: { ":next": 2 },
      condition: { expression: "#v = :v", names: { "#v": "version" }, values: { ":v": 1 } },
    },
    { kind: "put" as const, item: { PK: "AUDIT#2026-11", SK: "x" } },
  ];

  it("sends one transaction and merges the update's and the condition's names and values", async () => {
    dynamo.on(TransactWriteCommand).resolves({});

    await createDynamoOrderAdminRepository().commit(steps);

    const items = dynamo.commandCalls(TransactWriteCommand)[0]?.args[0].input.TransactItems;
    expect(items).toHaveLength(2);
    expect(items?.[0]?.Update).toMatchObject({
      UpdateExpression: "SET #v = :next",
      ConditionExpression: "#v = :v",
      ExpressionAttributeNames: { "#v": "version" },
      ExpressionAttributeValues: { ":next": 2, ":v": 1 },
    });
    expect(items?.[1]?.Put?.Item).toMatchObject({ PK: "AUDIT#2026-11" });
  });

  it("reports a failed condition as a conflict of that step's kind", async () => {
    dynamo.on(TransactWriteCommand).rejects(
      new TransactionCanceledException({
        message: "cancelled",
        $metadata: {},
        CancellationReasons: [{ Code: "ConditionalCheckFailed" }, { Code: "None" }],
      }),
    );

    await expect(createDynamoOrderAdminRepository().commit(steps)).rejects.toMatchObject({
      name: "OrderWriteConflict",
      kind: "version",
    });
    await expect(createDynamoOrderAdminRepository().commit(steps)).rejects.toBeInstanceOf(
      OrderWriteConflict,
    );
  });

  it("turns any other failure into a database error with no SDK text for the user", async () => {
    dynamo.on(TransactWriteCommand).rejects(new Error("table peptologics-staging exploded"));

    await expect(createDynamoOrderAdminRepository().commit(steps)).rejects.toMatchObject({
      name: "DatabaseError",
    });
  });
});

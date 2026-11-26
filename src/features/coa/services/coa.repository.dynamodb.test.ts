import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDynamoCoaRepository } from "@/features/coa/services/coa.repository.dynamodb";
import { DatabaseError } from "@/lib/errors";
import { coaRecord } from "@/test/coaFactories";

vi.mock("@/lib/dynamodb/client.server", async () => {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient: Doc } = await import("@aws-sdk/lib-dynamodb");
  const client = Doc.from(new DynamoDBClient({ region: "us-east-1" }));
  return { getDocumentClient: () => client, getTableName: () => "test-table" };
});

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

let dynamo: ReturnType<typeof mockClient>;

beforeEach(() => {
  dynamo = mockClient(DynamoDBDocumentClient);
});

afterEach(() => {
  dynamo.restore();
});

function lastQuery(index = 0) {
  return dynamo.commandCalls(QueryCommand)[index]?.args[0].input;
}

describe("findCurrent", () => {
  it("reads the highest version of the report's partition, strongly consistent", async () => {
    dynamo.on(QueryCommand).resolves({ Items: [coaRecord({ version: 3 })] });

    const report = await createDynamoCoaRepository().findCurrent("AX-2026-4139-WDN9");

    expect(report?.version).toBe(3);
    expect(lastQuery()).toMatchObject({
      TableName: "test-table",
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": "COA#AX-2026-4139-WDN9" },
      ScanIndexForward: false,
      Limit: 1,
      ConsistentRead: true,
    });
    expect(lastQuery()?.IndexName).toBeUndefined();
  });

  it("returns null when the report does not exist", async () => {
    dynamo.on(QueryCommand).resolves({ Items: [] });

    expect(await createDynamoCoaRepository().findCurrent("COA9999")).toBeNull();
  });

  it("returns null for a stored record that cannot be read, rather than a half-formed page", async () => {
    dynamo.on(QueryCommand).resolves({ Items: [coaRecord({ lab_id: "acme" })] });

    expect(await createDynamoCoaRepository().findCurrent("AX-2026-4139-WDN9")).toBeNull();
  });

  it("names reserved words through placeholders", async () => {
    dynamo.on(QueryCommand).resolves({ Items: [] });
    await createDynamoCoaRepository().findCurrent("COA9405");

    const names = Object.values(lastQuery()?.ExpressionAttributeNames ?? {});
    expect(names).toContain("status");
    expect(lastQuery()?.ProjectionExpression).not.toContain("status");
  });

  it("wraps an SDK failure in a DatabaseError", async () => {
    dynamo.on(QueryCommand).rejects(new Error("AccessDeniedException: table peptologics-prod"));

    await expect(createDynamoCoaRepository().findCurrent("COA9405")).rejects.toBeInstanceOf(
      DatabaseError,
    );
  });
});

describe("listVersions", () => {
  it("returns every version, newest first, following pagination", async () => {
    dynamo
      .on(QueryCommand)
      .resolvesOnce({ Items: [coaRecord({ version: 3 })], LastEvaluatedKey: { PK: "x", SK: "y" } })
      .resolvesOnce({ Items: [coaRecord({ version: 2 }), coaRecord({ version: 1 })] });

    const versions = await createDynamoCoaRepository().listVersions("AX-2026-4139-WDN9");

    expect(versions.map((entry) => entry.version)).toEqual([3, 2, 1]);
    expect(dynamo.commandCalls(QueryCommand)).toHaveLength(2);
    expect(lastQuery(0)).toMatchObject({ ScanIndexForward: false, ConsistentRead: true });
    expect(lastQuery(1)?.ExclusiveStartKey).toEqual({ PK: "x", SK: "y" });
  });
});

describe("listCurrent", () => {
  it("reads the sparse current-version partition on GSI1, newest issue date first", async () => {
    dynamo.on(QueryCommand).resolves({
      Items: [coaRecord(), coaRecord({ report_id: "COA9405", lab_id: "bioviridian" })],
    });

    const reports = await createDynamoCoaRepository().listCurrent();

    expect(reports.map((report) => report.reportId)).toEqual(["AX-2026-4139-WDN9", "COA9405"]);
    expect(lastQuery()).toMatchObject({
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: { ":pk": "COA_CURRENT" },
      ScanIndexForward: false,
    });
  });

  it("asks for summary attributes only, not the results or images", async () => {
    dynamo.on(QueryCommand).resolves({ Items: [] });
    await createDynamoCoaRepository().listCurrent();

    const names = Object.values(lastQuery()?.ExpressionAttributeNames ?? {});
    expect(names).toContain("purity_percent");
    expect(names).not.toContain("results");
    expect(names).not.toContain("chromatograms");
  });

  it("skips an unreadable record and keeps the rest", async () => {
    dynamo.on(QueryCommand).resolves({
      Items: [coaRecord({ lab_id: "acme" }), coaRecord({ report_id: "COA9405" })],
    });

    const reports = await createDynamoCoaRepository().listCurrent();

    expect(reports.map((report) => report.reportId)).toEqual(["COA9405"]);
  });

  it("follows pagination to the end", async () => {
    dynamo
      .on(QueryCommand)
      .resolvesOnce({ Items: [coaRecord()], LastEvaluatedKey: { PK: "x" } })
      .resolvesOnce({ Items: [coaRecord({ report_id: "COA9405" })] });

    expect(await createDynamoCoaRepository().listCurrent()).toHaveLength(2);
  });
});

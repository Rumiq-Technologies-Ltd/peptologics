import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { planPublish } from "@/features/coa/publish/coaPublishPlan";
import {
  commitPlan,
  fetchLatestVersion,
  fetchProduct,
  listProducts,
} from "@/features/coa/publish/coaStore";
import { coaReportContentSchema } from "@/features/coa/validation/coaReport.schema";
import { COA_PRODUCT_ID, rawCoaManifest } from "@/test/coaFactories";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));
let dynamo: ReturnType<typeof mockClient>;

beforeEach(() => {
  dynamo = mockClient(DynamoDBDocumentClient);
});

afterEach(() => {
  dynamo.restore();
});

const NOW = "2026-11-26T10:00:00.000Z";

function writePlan(latestVersion: number | null) {
  const content = coaReportContentSchema.parse(
    rawCoaManifest(latestVersion ? { purity_percent: 99.5, change_note: "Corrected." } : {}),
  );
  const latest = latestVersion
    ? { ...coaReportContentSchema.parse(rawCoaManifest()), version: latestVersion }
    : null;

  const plan = planPublish({
    content,
    latest,
    product: {
      id: COA_PRODUCT_ID,
      slug: "tesamorelin-20mg",
      name: "Tesamorelin",
      category: "peptide",
      strengthMg: 20,
      strengthUnit: "mg",
    },
    replacementExists: null,
    now: NOW,
  });

  if (plan.kind !== "write") throw new Error("expected a write plan");
  return plan;
}

describe("fetchLatestVersion", () => {
  it("reads the highest version of the report's partition, strongly consistent", async () => {
    dynamo.on(QueryCommand).resolves({ Items: [{ version: 4 }] });

    expect(await fetchLatestVersion(client, "t", "COA9405")).toEqual({ version: 4 });
    expect(dynamo.commandCalls(QueryCommand)[0]?.args[0].input).toMatchObject({
      TableName: "t",
      ExpressionAttributeValues: { ":pk": "COA#COA9405" },
      ScanIndexForward: false,
      Limit: 1,
      ConsistentRead: true,
    });
  });

  it("returns null for a report that was never published", async () => {
    dynamo.on(QueryCommand).resolves({ Items: [] });

    expect(await fetchLatestVersion(client, "t", "COA9405")).toBeNull();
  });
});

describe("fetchProduct", () => {
  const item = {
    id: COA_PRODUCT_ID,
    slug: "bpc-157-10mg",
    name: "BPC-157",
    category: "peptide",
    strength_mg: 10,
    strength_unit: "mg",
  };

  it("reads the product by key", async () => {
    dynamo.on(GetCommand).resolves({ Item: item });

    expect(await fetchProduct(client, "t", COA_PRODUCT_ID)).toMatchObject({ slug: "bpc-157-10mg" });
    expect(dynamo.commandCalls(GetCommand)[0]?.args[0].input.Key).toEqual({
      PK: `PRODUCT#${COA_PRODUCT_ID}`,
      SK: "META",
    });
  });

  it("returns null for a missing or soft-deleted product", async () => {
    dynamo
      .on(GetCommand)
      .resolvesOnce({})
      .resolvesOnce({ Item: { ...item, deleted_at: "2026-01-01" } });

    expect(await fetchProduct(client, "t", COA_PRODUCT_ID)).toBeNull();
    expect(await fetchProduct(client, "t", COA_PRODUCT_ID)).toBeNull();
  });
});

describe("listProducts", () => {
  it("reads the catalog partition and skips unreadable items", async () => {
    dynamo.on(QueryCommand).resolves({
      Items: [
        { id: "a", slug: "a", name: "A", category: "peptide", strength_mg: 5, strength_unit: "mg" },
        { id: "broken" },
      ],
    });

    expect(await listProducts(client, "t")).toHaveLength(1);
    expect(dynamo.commandCalls(QueryCommand)[0]?.args[0].input).toMatchObject({
      IndexName: "GSI1",
      ExpressionAttributeValues: { ":pk": "PRODUCTS" },
    });
  });
});

describe("commitPlan", () => {
  it("puts a first version with a guard against overwriting, and nothing else", async () => {
    dynamo.on(TransactWriteCommand).resolves({});
    await commitPlan(client, "t", writePlan(null));

    const items = dynamo.commandCalls(TransactWriteCommand)[0]?.args[0].input.TransactItems ?? [];

    expect(items).toHaveLength(1);
    expect(items[0]?.Put).toMatchObject({
      TableName: "t",
      ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
    });
    expect(items[0]?.Put?.Item).toMatchObject({ SK: "V#0001", GSI1PK: "COA_CURRENT" });
  });

  it("puts the new version and removes the previous one's index keys in one transaction", async () => {
    dynamo.on(TransactWriteCommand).resolves({});
    await commitPlan(client, "t", writePlan(1));

    const items = dynamo.commandCalls(TransactWriteCommand)[0]?.args[0].input.TransactItems ?? [];

    expect(items).toHaveLength(2);
    expect(items[0]?.Put?.Item).toMatchObject({ SK: "V#0002" });
    expect(items[1]?.Update).toMatchObject({
      Key: { PK: "COA#AX-2026-4139-WDN9", SK: "V#0001" },
      UpdateExpression: "REMOVE GSI1PK, GSI1SK",
      ConditionExpression: "attribute_exists(PK)",
    });
  });

  it("lets a conflict reach the caller instead of swallowing it", async () => {
    dynamo.on(TransactWriteCommand).rejects(new Error("TransactionCanceledException"));

    await expect(commitPlan(client, "t", writePlan(null))).rejects.toThrow(/TransactionCanceled/);
  });
});

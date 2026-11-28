/**
 * Adds the order-number lookup key (GSI2PK = ORDERNO#<number>) to orders that lack it, so the
 * admin can open an order by its number (D41, Chat 14).
 *
 * New orders and the Stage 4 copy get the key from `buildOrderItems`; this is for orders already
 * in a table. Run with plain Node (it runs TypeScript natively, no build step):
 *
 *   node scripts/backfill-order-number-index.ts --table peptologics-staging            (dry run)
 *   node scripts/backfill-order-number-index.ts --table peptologics-staging --apply
 *
 *   --table <name>   Target table. Required.
 *   --dry-run        The default. Reads and reports; writes nothing.
 *   --apply          Write. Safe to repeat: only order META items still without GSI2PK change.
 *   --allow-prod     Required to target a table whose name contains "prod".
 *
 * Touches nothing but order META items (`entity = order`) that have no GSI2PK, and sets only that
 * one attribute, with a condition that it is still missing. It reads with a Scan, once, because no
 * index lists every order: acceptable for a one-off over a small table. It never prints customer
 * values, only order numbers and counts. Uses the AWS default credential chain (AWS_PROFILE).
 *
 * Exit code is 1 if any check fails.
 */

import { parseArgs } from "node:util";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { orderNumberPartition } from "../src/lib/dynamodb/entities.ts";

const AWS_REGION = "us-east-1";

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(2);
}

const { values: args } = parseArgs({
  options: {
    table: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    apply: { type: "boolean", default: false },
    "allow-prod": { type: "boolean", default: false },
  },
  strict: true,
});

const tableName = args.table ?? fail("--table <name> is required.");
if (args.apply && args["dry-run"]) fail("Pass --apply or --dry-run, not both.");
if (/prod/i.test(tableName) && !args["allow-prod"]) {
  fail(`Refusing to target "${tableName}" without --allow-prod.`);
}

const apply = args.apply === true;

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

interface OrderKey {
  PK: string;
  SK: string;
  order_number: string;
}

/** Order META items that lack the lookup key. Only the three attributes needed are read. */
async function findMissing(): Promise<{ missing: OrderKey[]; total: number }> {
  const missing: OrderKey[] = [];
  let total = 0;
  let startKey: Record<string, unknown> | undefined;

  do {
    const page = await client.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "#e = :order",
        ExpressionAttributeNames: { "#e": "entity" },
        ExpressionAttributeValues: { ":order": "order" },
        ProjectionExpression: "PK, SK, order_number, GSI2PK",
        ExclusiveStartKey: startKey,
      }),
    );

    for (const item of page.Items ?? []) {
      total += 1;
      if (item.GSI2PK === undefined) missing.push(item as unknown as OrderKey);
    }
    startKey = page.LastEvaluatedKey;
  } while (startKey);

  return { missing, total };
}

const { missing, total } = await findMissing();
console.log(`${apply ? "APPLY" : "DRY RUN"} on ${tableName}`);
console.log(`Orders found: ${total}; without the lookup key: ${missing.length}`);

let updated = 0;
let invalid = 0;

for (const order of missing) {
  if (typeof order.order_number !== "string" || order.order_number.length === 0) {
    invalid += 1;
    console.error(`Skipping ${order.PK}: no order number.`);
    continue;
  }

  if (!apply) {
    console.log(`Would set the key on ${order.order_number}`);
    continue;
  }

  await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: order.PK, SK: order.SK },
      UpdateExpression: "SET GSI2PK = :key",
      // Never overwrite, and never create an item that is not an order.
      ConditionExpression: "attribute_not_exists(GSI2PK) AND #e = :order",
      ExpressionAttributeNames: { "#e": "entity" },
      ExpressionAttributeValues: {
        ":key": orderNumberPartition(order.order_number),
        ":order": "order",
      },
    }),
  );
  updated += 1;
  console.log(`Set the key on ${order.order_number}`);
}

if (apply) {
  const after = await findMissing();
  console.log(`Updated: ${updated}; still without the key: ${after.missing.length}`);
  if (after.missing.length > 0 || invalid > 0) process.exit(1);
} else if (invalid > 0) {
  process.exit(1);
}

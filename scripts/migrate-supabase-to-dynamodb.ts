/**
 * Copies PeptoLogics data from Supabase into a DynamoDB table (ADR-035).
 *
 * Run with plain Node (it runs TypeScript natively, no build step):
 *
 *   node --env-file=.env.local scripts/migrate-supabase-to-dynamodb.ts --table peptologics-dev --products-only
 *
 * Reads Supabase with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the environment;
 * writes with the AWS default credential chain (AWS_PROFILE locally) in us-east-1.
 *
 *   --table <name>          Target table. Required.
 *   --dry-run               The default. Reads Supabase and reports; writes nothing and
 *                           needs no AWS credentials.
 *   --apply                 Actually write. Safe to repeat: items are keyed on the original
 *                           ids, so a second run overwrites with identical data.
 *   --products-only         Copy the product catalog and nothing else. The dev table gets
 *                           this and never customer data.
 *   --since <ISO timestamp> Delta pass: only rows created or updated after this time (an
 *                           order is also included when one of its notifications changed).
 *   --counter-floor <n>     Raise the order-number counter to at least n (cutover: the
 *                           highest Supabase order number plus a safety gap). Never lowers.
 *   --allow-prod            Required to target a table whose name contains "prod". Only the
 *                           control chat passes this.
 *
 * Copies everything, including soft-deleted rows with deleted_at kept (D9). Keeps the
 * original id, order_number, created_at and updated_at. Prints a verification report of
 * counts, sums and pass/fail checks; it never prints customer values.
 *
 * Exit code is 1 if any check fails.
 */

import { parseArgs } from "node:util";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { createClient } from "@supabase/supabase-js";

import {
  buildNotificationItem,
  buildOrderItems,
  buildOrderLineItem,
  buildProductItems,
  computeCostPerMg,
  keys,
  ORDER_COUNTER_START,
  parseOrderNumber,
  type Item,
  type NotificationSource,
  type OrderLineSource,
  type OrderSource,
  type ProductSource,
} from "../src/lib/dynamodb/entities.ts";

type Row = Record<string, unknown>;

const AWS_REGION = "us-east-1";
const PAGE_SIZE = 1000;
const IN_CLAUSE_SIZE = 100;
const WRITE_CONCURRENCY = 10;
const SPOT_CHECK_SIZE = 5;
const COST_PER_MG_TOLERANCE = 1e-9;
/** Supabase stores cost_per_mg to 4 decimals; compare to that precision. */
const SUPABASE_COST_PRECISION = 0.00006;

// --- Arguments ---------------------------------------------------------------

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(2);
}

const { values: args } = parseArgs({
  options: {
    table: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    apply: { type: "boolean", default: false },
    "products-only": { type: "boolean", default: false },
    since: { type: "string" },
    "counter-floor": { type: "string" },
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
const productsOnly = args["products-only"] === true;

const since = args.since;
if (since !== undefined && Number.isNaN(Date.parse(since)))
  fail("--since must be an ISO timestamp.");

const counterFloor =
  args["counter-floor"] === undefined ? undefined : Number(args["counter-floor"]);
if (counterFloor !== undefined && !Number.isInteger(counterFloor)) {
  fail("--counter-floor must be an integer.");
}
if (productsOnly && counterFloor !== undefined)
  fail("--counter-floor does not apply with --products-only.");

const supabaseUrl = process.env.SUPABASE_URL ?? fail("SUPABASE_URL is not set.");
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? fail("SUPABASE_SERVICE_ROLE_KEY is not set.");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const dynamo = apply
  ? DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }), {
      marshallOptions: { removeUndefinedValues: true },
    })
  : undefined;

// --- Reading Supabase --------------------------------------------------------

type Filter =
  | { kind: "since"; since: string }
  | { kind: "in"; column: string; values: string[] }
  | { kind: "after"; column: string; value: string };

/**
 * `select("*")` is deliberate here, unlike in the application: a migration must carry
 * every column, including ones added after this script was written.
 */
async function fetchAll(table: string, filter?: Filter): Promise<Row[]> {
  const rows: Row[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from(table).select("*");

    if (filter?.kind === "since") {
      query = query.or(`created_at.gt.${filter.since},updated_at.gt.${filter.since}`);
    } else if (filter?.kind === "in") {
      query = query.in(filter.column, filter.values);
    } else if (filter?.kind === "after") {
      query = query.gt(filter.column, filter.value);
    }

    const { data, error } = await query.order("id").range(from, from + PAGE_SIZE - 1);
    if (error) fail(`Reading ${table} from Supabase failed: ${error.message}`);

    rows.push(...((data ?? []) as Row[]));
    if ((data ?? []).length < PAGE_SIZE) return rows;
  }
}

async function fetchByOrderIds(table: string, orderIds: string[]): Promise<Row[]> {
  const rows: Row[] = [];

  for (let start = 0; start < orderIds.length; start += IN_CLAUSE_SIZE) {
    const chunk = orderIds.slice(start, start + IN_CLAUSE_SIZE);
    rows.push(...(await fetchAll(table, { kind: "in", column: "order_id", values: chunk })));
  }

  return rows;
}

async function fetchHighestOrderSequence(): Promise<number | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("order_number")
    .order("order_number", { ascending: false })
    .limit(1);

  if (error) fail(`Reading the highest order number failed: ${error.message}`);

  const orderNumber = data?.[0]?.order_number;
  return typeof orderNumber === "string" ? parseOrderNumber(orderNumber) : null;
}

// --- Plan --------------------------------------------------------------------

const sinceFilter: Filter | undefined = since ? { kind: "since", since } : undefined;

const now = new Date().toISOString();
const products = (await fetchAll("products", sinceFilter)) as unknown as ProductSource[];

let orders: OrderSource[] = [];
let lines: OrderLineSource[] = [];
let notifications: NotificationSource[] = [];

if (!productsOnly) {
  if (since) {
    const changed = (await fetchAll("notification_log", {
      kind: "after",
      column: "updated_at",
      value: since,
    })) as unknown as NotificationSource[];
    const fromOrders = (await fetchAll("orders", sinceFilter)) as unknown as OrderSource[];

    const ids = [...new Set([...fromOrders.map((o) => o.id), ...changed.map((n) => n.order_id)])];
    orders = [];
    for (let start = 0; start < ids.length; start += IN_CLAUSE_SIZE) {
      const chunk = ids.slice(start, start + IN_CLAUSE_SIZE);
      orders.push(
        ...((await fetchAll("orders", {
          kind: "in",
          column: "id",
          values: chunk,
        })) as unknown as OrderSource[]),
      );
    }
  } else {
    orders = (await fetchAll("orders")) as unknown as OrderSource[];
  }

  const orderIds = orders.map((order) => order.id);
  lines = (await fetchByOrderIds("order_items", orderIds)) as unknown as OrderLineSource[];
  notifications = (await fetchByOrderIds(
    "notification_log",
    orderIds,
  )) as unknown as NotificationSource[];
}

const items: Item[] = [
  ...products.flatMap((product) => buildProductItems(product, now)),
  ...orders.flatMap((order) => buildOrderItems(order)),
  ...lines.map((line) => buildOrderLineItem(line)),
  ...notifications.map((notification) => buildNotificationItem(notification)),
];

const highestSequence = productsOnly ? null : await fetchHighestOrderSequence();
const counterValue = Math.max(highestSequence ?? 0, counterFloor ?? 0, ORDER_COUNTER_START);

// --- Writing -----------------------------------------------------------------

async function writeAll(): Promise<void> {
  if (!dynamo) return;

  for (let start = 0; start < items.length; start += WRITE_CONCURRENCY) {
    await Promise.all(
      items
        .slice(start, start + WRITE_CONCURRENCY)
        .map((Item) => dynamo.send(new PutCommand({ TableName: tableName, Item }))),
    );
  }

  if (productsOnly) return;

  try {
    // Never lower the counter: a delta pass must not undo numbers already issued.
    await dynamo.send(
      new UpdateCommand({
        TableName: tableName,
        Key: keys.orderCounter,
        UpdateExpression: "SET seq = :value",
        ConditionExpression: "attribute_not_exists(seq) OR seq < :value",
        ExpressionAttributeValues: { ":value": counterValue },
      }),
    );
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "ConditionalCheckFailedException") throw error;
  }
}

// --- Verification report -----------------------------------------------------

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const checks: Check[] = [];

function check(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail });
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** Null and absent are the same thing; everything else compares by value. */
function sameValue(source: unknown, stored: unknown): boolean {
  if (source === null || source === undefined) return stored === undefined || stored === null;
  if (typeof source === "string" && typeof stored === "number") return Number(source) === stored;
  return source === stored;
}

/** Fields of `source` that differ from `stored`, by name only (never by value). */
function differingFields(source: Row, stored: Row | undefined): string[] {
  if (!stored) return ["(item missing)"];
  return Object.keys(source).filter((field) => !sameValue(source[field], stored[field]));
}

function pickRandom<T>(list: readonly T[], count: number): T[] {
  return [...list].sort(() => Math.random() - 0.5).slice(0, count);
}

function builtItem(pk: string, sk: string): Item | undefined {
  return items.find((item) => item.PK === pk && item.SK === sk);
}

async function readBack(key: { PK: string; SK: string }): Promise<Row | undefined> {
  if (!dynamo) return undefined;
  const { Item } = await dynamo.send(
    new GetCommand({ TableName: tableName, Key: key, ConsistentRead: true }),
  );
  return Item;
}

async function verify(): Promise<void> {
  // Products
  let costMismatches = 0;

  for (const product of products) {
    const built = builtItem(keys.product(product.id).PK, "META");
    const expected = computeCostPerMg(product.price_cents, Number(product.strength_mg));
    const stored = Number(built?.cost_per_mg);
    const supabaseCost = (product as unknown as Row).cost_per_mg;

    const matchesRecomputed = Math.abs(stored - expected) < COST_PER_MG_TOLERANCE;
    const matchesSupabase =
      supabaseCost === null ||
      supabaseCost === undefined ||
      Math.abs(stored - Number(supabaseCost)) < SUPABASE_COST_PRECISION;
    if (!matchesRecomputed || !matchesSupabase) costMismatches += 1;
  }

  // A delta pass may legitimately carry no products.
  check(
    "products copied",
    since !== undefined || products.length > 0,
    `${products.length} product(s)`,
  );
  const publicCount = products.filter((p) => p.status === "active" && !p.deleted_at).length;
  check(
    "public products (active, not deleted) present",
    since !== undefined || publicCount > 0,
    `${publicCount} of ${products.length} (the handoff expected 12; informational)`,
  );
  check(
    "cost_per_mg matches price/strength and Supabase",
    costMismatches === 0,
    `${costMismatches} mismatch(es)`,
  );

  // After a real write, read every product back and compare it with what was built.
  if (dynamo) {
    let readBackFailures = 0;

    for (const product of products) {
      const built = builtItem(keys.product(product.id).PK, "META");
      const stored = await readBack(keys.product(product.id));
      if (!built || differingFields(built, stored).length > 0) readBackFailures += 1;
    }

    check(
      "every product read back from the table matches",
      readBackFailures === 0,
      `${readBackFailures} differ`,
    );
  }

  if (!productsOnly) {
    // Order integrity at the source.
    const linesByOrder = new Map<string, OrderLineSource[]>();
    for (const line of lines)
      linesByOrder.set(line.order_id, [...(linesByOrder.get(line.order_id) ?? []), line]);

    const notificationsByOrder = new Map<string, number>();
    for (const n of notifications)
      notificationsByOrder.set(n.order_id, (notificationsByOrder.get(n.order_id) ?? 0) + 1);

    const wrongItemCount = orders.filter(
      (o) => (linesByOrder.get(o.id)?.length ?? 0) !== o.item_count,
    ).length;
    const wrongSubtotal = orders.filter(
      (o) => sum((linesByOrder.get(o.id) ?? []).map((l) => l.subtotal_cents)) !== o.subtotal_cents,
    ).length;
    const noNotifications = orders.filter((o) => !notificationsByOrder.has(o.id)).length;

    check(
      "every order has item_count lines",
      wrongItemCount === 0,
      `${wrongItemCount} order(s) differ`,
    );
    check(
      "order subtotal equals the sum of its lines",
      wrongSubtotal === 0,
      `${wrongSubtotal} order(s) differ`,
    );
    check(
      "every order has at least one notification",
      noNotifications === 0,
      `${noNotifications} order(s) have none`,
    );

    // Spot check: source row vs the item this script builds (and, with --apply, vs the table).
    const sample = pickRandom(orders, SPOT_CHECK_SIZE);
    let spotFailures = 0;

    for (const order of sample) {
      const built = builtItem(keys.order(order.id).PK, "META");
      let differing = differingFields(order as unknown as Row, built);

      if (dynamo) {
        differing = [
          ...differing,
          ...differingFields(order as unknown as Row, await readBack(keys.order(order.id))),
        ];
      }
      if (differing.length > 0) spotFailures += 1;
    }
    check(
      `spot check of ${sample.length} random order(s), field by field`,
      spotFailures === 0,
      `${spotFailures} order(s) differ`,
    );

    // After a real write, read every migrated order's partition back from the table.
    if (dynamo) {
      let missing = 0;
      let storedSubtotal = 0;
      let storedLines = 0;
      let storedNotifications = 0;

      for (const order of orders) {
        const { Items = [] } = await dynamo.send(
          new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: "PK = :pk",
            ExpressionAttributeValues: { ":pk": keys.order(order.id).PK },
            ConsistentRead: true,
          }),
        );
        const meta = Items.find((item) => item.SK === "META");
        if (!meta) missing += 1;
        storedSubtotal += Number(meta?.subtotal_cents ?? 0);
        storedLines += Items.filter((item) => String(item.SK).startsWith("ITEM#")).length;
        storedNotifications += Items.filter((item) => String(item.SK).startsWith("NOTIF#")).length;
      }

      check("every order is in the table", missing === 0, `${missing} missing`);
      check(
        "table totals match the source (subtotal, lines, notifications)",
        storedSubtotal === sum(orders.map((o) => o.subtotal_cents)) &&
          storedLines === lines.length &&
          storedNotifications === notifications.length,
        `subtotal ${storedSubtotal}, lines ${storedLines}, notifications ${storedNotifications}`,
      );
    }
  }
}

// --- Run ---------------------------------------------------------------------

await writeAll();
await verify();

const openNotifications = notifications.filter(
  (n) => n.status === "pending" || n.status === "failed",
).length;

console.log(`\nSupabase -> DynamoDB ${apply ? "APPLIED" : "DRY RUN (nothing written)"}`);
console.log(`  table:          ${tableName}`);
console.log(
  `  mode:           ${productsOnly ? "products only" : "everything"}${since ? `, delta since ${since}` : ", full copy"}`,
);
console.log("\nSource rows");
console.log(`  products:       ${products.length}`);
console.log(
  `  orders:         ${orders.length}  (${orders.filter((o) => o.deleted_at).length} soft-deleted, kept)`,
);
console.log(`  order lines:    ${lines.length}`);
console.log(
  `  notifications:  ${notifications.length}  (${openNotifications} open: pending/failed)`,
);
console.log(`  sum of subtotal_cents: ${sum(orders.map((o) => o.subtotal_cents))}`);
console.log(`\nDynamoDB items ${apply ? "written" : "that would be written"}: ${items.length}`);
if (!productsOnly) {
  console.log(
    `Order counter ${apply ? "set to at least" : "would be set to at least"}: ${counterValue}` +
      ` (next order number ${`PL-${String(counterValue + 1).padStart(6, "0")}`})`,
  );
}
console.log("\nCatalog");
for (const line of productsCatalogLines()) console.log(line);
console.log("\nChecks");
for (const { name, ok, detail } of checks)
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}: ${detail}`);

const failed = checks.filter((entry) => !entry.ok).length;
console.log(`\n${failed === 0 ? "All checks passed." : `${failed} check(s) FAILED.`}`);
process.exit(failed === 0 ? 0 : 1);

function productsCatalogLines(): string[] {
  return products.map((product) => {
    const cost = computeCostPerMg(product.price_cents, Number(product.strength_mg));
    return `    ${product.slug.padEnd(22)} price_cents=${product.price_cents} strength=${product.strength_mg} cost_per_mg=${cost.toFixed(6)}`;
  });
}

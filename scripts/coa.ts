/**
 * Publishes, amends, withdraws and supersedes Certificate of Analysis reports (ADR-038).
 *
 *   npm run coa -- products   --table peptologics-dev
 *   npm run coa -- publish    data/coa/<REPORT_ID>.json --table peptologics-dev [--apply]
 *   npm run coa -- withdraw   <REPORT_ID> --reason "..." --table peptologics-dev [--apply]
 *   npm run coa -- supersede  <REPORT_ID> --by <NEW_REPORT_ID> --reason "..." --table ... [--apply]
 *
 * (`npm run coa` is `node --import ./scripts/register-aliases.mjs --env-file=.env.local
 * scripts/coa.ts`: plain Node, with the app's own validation and rules imported by alias.)
 *
 *   --table <name>          Target table. Required.
 *   --apply                 Actually write. Without it this is a dry run: it validates, reads
 *                           the table, prints exactly what it would write, and writes nothing.
 *   --reason <text>         Why a report is withdrawn or superseded. Shown publicly.
 *   --by <report id>        The report that replaces a superseded one. Must be published.
 *   --revalidate-url <url>  After a write, ask this site to refresh its cached pages (needs
 *                           REVALIDATE_SECRET in the environment). Optional.
 *   --allow-prod            Required to target a table whose name contains "prod". Only the
 *                           control chat passes this.
 *
 * Reads and writes use the AWS default credential chain (AWS_PROFILE locally) in us-east-1.
 * A dry run still *reads* the table, so it needs credentials; it never writes.
 *
 * Exit code is 1 if the report is blocked, a file is missing, or a write fails.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { getCoaLab } from "@/features/coa/constants/labs";
import {
  contentWithStatus,
  findMissingFiles,
  planPublish,
  type PublishPlan,
  type PublishProduct,
  type StoredCoaVersion,
} from "@/features/coa/publish/coaPublishPlan";
import {
  commitPlan,
  fetchLatestVersion,
  fetchProduct,
  listProducts,
} from "@/features/coa/publish/coaStore";
import { normalizeReportId } from "@/features/coa/utils/normalizeReportId";
import {
  coaReportContentSchema,
  type CoaReportContent,
} from "@/features/coa/validation/coaReport.schema";

const AWS_REGION = "us-east-1";
const PUBLIC_DIRECTORY = path.resolve(import.meta.dirname, "..", "public");
const REVALIDATE_TIMEOUT_MS = 15_000;

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    table: { type: "string" },
    apply: { type: "boolean", default: false },
    reason: { type: "string" },
    by: { type: "string" },
    "revalidate-url": { type: "string" },
    "allow-prod": { type: "boolean", default: false },
  },
});

function fail(message: string): never {
  console.error(`\nError: ${message}`);
  process.exit(1);
}

function line(label: string, value: string | number | undefined | null): void {
  if (value !== undefined && value !== null && value !== "") {
    console.log(`  ${label.padEnd(20)} ${value}`);
  }
}

const tableName = args.table ?? fail("--table is required.");

if (/prod/i.test(tableName) && !args["allow-prod"]) {
  fail(`Refusing to target "${tableName}" without --allow-prod.`);
}

/** Test fixtures are fake. They may only ever be written to a development table. */
const TEST_REPORT_PREFIX = "TEST-";

function isDevelopmentTable(name: string): boolean {
  return /dev/i.test(name);
}

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

// --- Output ------------------------------------------------------------------------------

/** Everything a person needs to compare against the laboratory's own report. */
function printReport(
  content: CoaReportContent,
  product: PublishProduct | null,
  latest: StoredCoaVersion | null,
): void {
  const lab = getCoaLab(content.lab_id as Parameters<typeof getCoaLab>[0]);

  console.log(
    `\nReport ${content.report_id}  (${latest ? `amends version ${String(latest.version)}` : "new"})`,
  );
  line("Status", content.status);
  line("Laboratory", `${lab.name}  (verify at ${lab.verifyPageUrl})`);
  line("Lab verify code", content.lab_verification_code);
  line(
    "Product",
    product ? `${product.name}  [${product.slug}, ${product.category}]` : "NOT FOUND",
  );
  line("Compound (report)", content.compound_name);
  line("Lot", content.lot_number);
  line("Tested strength", `${content.tested_strength_mg} ${content.tested_strength_unit}`);
  line("Sample received", content.sample_received_on);
  line("Issued", content.issued_on);
  line(
    "Purity (measured)",
    content.purity_percent === undefined ? undefined : `${content.purity_percent}%`,
  );
  line(
    "Net content",
    content.net_content_mg === undefined ? undefined : `${content.net_content_mg} mg`,
  );
  line("Scan", content.scan_path);
  for (const image of content.chromatograms)
    line("Chromatogram", `${image.path}  "${image.caption}"`);
  line("Change note", content.change_note);

  console.log("\n  Results as they will be shown:");
  for (const row of content.results) {
    console.log(
      `    - ${row.test} | ${row.method} | spec: ${row.specification} | result: ${row.result} | ${row.outcome}`,
    );
  }
}

function printPlan(plan: PublishPlan, missingFiles: string[]): boolean {
  const problems = [
    ...(plan.kind === "blocked" ? plan.problems : []),
    ...missingFiles.map(
      (file) => `File not found: public${file}. Add it to the pull request first.`,
    ),
  ];

  if (problems.length > 0) {
    console.log("\nBLOCKED. Fix these, then run again:");
    for (const problem of problems) console.log(`  - ${problem}`);
    return false;
  }

  if (plan.kind === "unchanged") {
    console.log(`\nNothing to do: version ${plan.version} already matches this manifest.`);
    return true;
  }

  if (plan.kind === "write") {
    console.log(`\nWould write version ${plan.version} as the current version.`);
    if (plan.previousKey)
      console.log(`  and remove the current-version marker from ${plan.previousKey.SK}.`);
    for (const note of plan.summary.notes) console.log(`  note: ${note}`);
  }

  return true;
}

// --- Cache refresh -----------------------------------------------------------------------

async function purgeCache(origin: string, slug: string): Promise<void> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    console.log(
      "\nCache not refreshed: REVALIDATE_SECRET is not set. Pages refresh within the hour.",
    );
    return;
  }

  try {
    const response = await fetch(new URL("/api/revalidate", origin), {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ slug }),
      signal: AbortSignal.timeout(REVALIDATE_TIMEOUT_MS),
    });

    console.log(
      response.ok
        ? "\nSite cache refreshed."
        : `\nCache refresh returned ${response.status}. The data is saved; pages refresh within the hour.`,
    );
  } catch {
    console.log("\nCache refresh failed. The data is saved; pages refresh within the hour.");
  }
}

// --- Commands ----------------------------------------------------------------------------

async function runPlan(content: CoaReportContent, options: { checkFiles: boolean }): Promise<void> {
  if (content.report_id.startsWith(TEST_REPORT_PREFIX) && !isDevelopmentTable(tableName)) {
    fail(`${content.report_id} is a test fixture and may only be written to a dev table.`);
  }

  const replacementId = content.superseded_by;

  const [latest, product, replacement] = await Promise.all([
    fetchLatestVersion(client, tableName, content.report_id),
    fetchProduct(client, tableName, content.product_id),
    replacementId ? fetchLatestVersion(client, tableName, replacementId) : Promise.resolve(null),
  ]);

  const missingFiles = options.checkFiles
    ? findMissingFiles(content, (sitePath) => existsSync(path.join(PUBLIC_DIRECTORY, sitePath)))
    : [];

  const plan = planPublish({
    content,
    latest,
    product,
    replacementExists: replacementId ? replacement !== null : null,
    now: new Date().toISOString(),
  });

  printReport(content, product, latest);
  if (!printPlan(plan, missingFiles)) process.exit(1);

  if (plan.kind !== "write") return;

  if (!args.apply) {
    console.log(`\nDry run: nothing written to ${tableName}. Add --apply to write.`);
    return;
  }

  try {
    await commitPlan(client, tableName, plan);
  } catch (error) {
    if (error instanceof Error && error.name === "TransactionCanceledException") {
      fail(
        "Someone published this report at the same moment, so nothing was written. Run again to see its new state.",
      );
    }
    throw error;
  }

  console.log(`\nWritten to ${tableName}: ${plan.reportId} version ${plan.version}.`);

  const origin = args["revalidate-url"];
  if (origin && product) await purgeCache(origin, product.slug);
}

async function publish(file: string | undefined): Promise<void> {
  if (!file) fail("publish needs a manifest file, for example data/coa/AX-2026-4139-WDN9.json");

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    fail(
      `Could not read ${file} as JSON: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  const parsed = coaReportContentSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`\n${file} is not a valid report:`);
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".") || "(report)"}: ${issue.message}`);
    }
    process.exit(1);
  }

  await runPlan(parsed.data, { checkFiles: true });
}

async function changeStatus(
  status: "withdrawn" | "superseded",
  target: string | undefined,
): Promise<void> {
  const reportId = target ? normalizeReportId(target) : null;
  if (!reportId) fail(`${status === "withdrawn" ? "withdraw" : "supersede"} needs a report ID.`);
  if (!args.reason) fail("--reason is required; it is shown publicly.");
  if (status === "superseded" && !args.by) fail("--by <report id> is required to supersede.");

  const latest = await fetchLatestVersion(client, tableName, reportId);
  if (!latest) fail(`${reportId} has not been published to ${tableName}.`);

  const changed = contentWithStatus(latest, {
    status,
    reason: args.reason,
    supersededBy: args.by,
  });

  if (!changed.success) {
    console.error("\nCannot make that change:");
    for (const problem of changed.problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  await runPlan(changed.content, { checkFiles: false });
}

async function showProducts(): Promise<void> {
  const products = await listProducts(client, tableName);

  console.log(`\n${products.length} products in ${tableName}:\n`);
  for (const product of products.sort((a, b) => a.slug.localeCompare(b.slug))) {
    console.log(
      `  ${product.id}  ${product.slug.padEnd(28)} ${product.category.padEnd(9)} ${String(product.strengthMg).padStart(6)} ${product.strengthUnit}  ${product.name}`,
    );
  }
}

const [command, target] = positionals;

switch (command) {
  case "products":
    await showProducts();
    break;
  case "publish":
    await publish(target);
    break;
  case "withdraw":
    await changeStatus("withdrawn", target);
    break;
  case "supersede":
    await changeStatus("superseded", target);
    break;
  default:
    fail("Usage: coa <products|publish|withdraw|supersede> ... --table <name> [--apply]");
}

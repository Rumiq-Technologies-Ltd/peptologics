import "server-only";

import { QueryCommand } from "@aws-sdk/lib-dynamodb";

import {
  toCoaReport,
  toCoaReportSummary,
  toCoaVersionEntry,
  type CoaRecord,
} from "@/features/coa/mappers/coa.mappers";
import type { CoaRepository } from "@/features/coa/services/coa.repository";
import { getDocumentClient, getTableName } from "@/lib/dynamodb/client.server";
import { COA_CURRENT_PARTITION, INDEX, keys } from "@/lib/dynamodb/entities";
import { toDatabaseError } from "@/lib/dynamodb/errors";
import { projectionOf } from "@/lib/dynamodb/projection";
import { logger } from "@/lib/logger";

/**
 * COA reads on DynamoDB (ADR-035). Fetch only.
 *
 * A report is one partition, `COA#<report id>`, holding one immutable item per version. The
 * highest version is the current one. A listing reads the sparse `GSI1` partition that only
 * current versions are in, so it returns one item per report.
 *
 * A single report is read **strongly consistent**: a withdrawal must show on the very next
 * request, and the base table can offer that where an index cannot. Listings read the index,
 * which is eventually consistent, and are refreshed by the publish script's cache purge.
 */

/** Everything a record page renders. Names go through placeholders (`status` is reserved). */
const REPORT_ATTRIBUTES = [
  "report_id",
  "version",
  "status",
  "superseded_by",
  "change_note",
  "lab_id",
  "lab_verification_code",
  "product_id",
  "compound_name",
  "lot_number",
  "tested_strength_mg",
  "tested_strength_unit",
  "sample_received_on",
  "issued_on",
  "purity_percent",
  "net_content_mg",
  "results",
  "chromatograms",
  "scan_path",
  "updated_at",
] as const;

/** A listing leaves out the results and images. */
const SUMMARY_ATTRIBUTES = [
  "report_id",
  "version",
  "status",
  "superseded_by",
  "lab_id",
  "product_id",
  "compound_name",
  "lot_number",
  "tested_strength_mg",
  "tested_strength_unit",
  "issued_on",
  "purity_percent",
] as const;

const VERSION_ATTRIBUTES = ["version", "status", "change_note", "issued_on", "updated_at"] as const;

export function createDynamoCoaRepository(): CoaRepository {
  return {
    async findCurrent(reportId) {
      try {
        const page = await getDocumentClient().send(
          new QueryCommand({
            TableName: getTableName(),
            KeyConditionExpression: "PK = :pk",
            ExpressionAttributeValues: { ":pk": keys.coaPartition(reportId) },
            // Highest version first, and just that one.
            ScanIndexForward: false,
            Limit: 1,
            ConsistentRead: true,
            ...projectionOf(REPORT_ATTRIBUTES),
          }),
        );

        const first = page.Items?.[0] as CoaRecord | undefined;
        if (!first) return null;

        const report = toCoaReport(first);

        if (!report) {
          // Stored but unreadable: treat as absent, and say so where a developer can see it.
          logger.error("coa_record_unreadable", { reportId });
          return null;
        }

        return report;
      } catch (error) {
        throw toDatabaseError("coa.findCurrent", error);
      }
    },

    async listVersions(reportId) {
      const versions: NonNullable<ReturnType<typeof toCoaVersionEntry>>[] = [];
      let startKey: Record<string, unknown> | undefined;

      try {
        do {
          const page = await getDocumentClient().send(
            new QueryCommand({
              TableName: getTableName(),
              KeyConditionExpression: "PK = :pk",
              ExpressionAttributeValues: { ":pk": keys.coaPartition(reportId) },
              ScanIndexForward: false,
              ConsistentRead: true,
              ExclusiveStartKey: startKey,
              ...projectionOf(VERSION_ATTRIBUTES),
            }),
          );

          for (const item of page.Items ?? []) {
            const entry = toCoaVersionEntry(item as CoaRecord);
            if (entry) versions.push(entry);
          }

          startKey = page.LastEvaluatedKey;
        } while (startKey);
      } catch (error) {
        throw toDatabaseError("coa.listVersions", error);
      }

      return versions;
    },

    async listCurrent() {
      const reports: NonNullable<ReturnType<typeof toCoaReportSummary>>[] = [];
      let startKey: Record<string, unknown> | undefined;

      try {
        do {
          const page = await getDocumentClient().send(
            new QueryCommand({
              TableName: getTableName(),
              IndexName: INDEX.primary,
              KeyConditionExpression: "GSI1PK = :pk",
              ExpressionAttributeValues: { ":pk": COA_CURRENT_PARTITION },
              // `GSI1SK` leads with the issue date, so descending is newest first.
              ScanIndexForward: false,
              ExclusiveStartKey: startKey,
              ...projectionOf(SUMMARY_ATTRIBUTES),
            }),
          );

          for (const item of page.Items ?? []) {
            const summary = toCoaReportSummary(item as CoaRecord);

            if (summary) {
              reports.push(summary);
            } else {
              logger.error("coa_record_unreadable", { reportId: (item as CoaRecord).report_id });
            }
          }

          startKey = page.LastEvaluatedKey;
        } while (startKey);
      } catch (error) {
        throw toDatabaseError("coa.listCurrent", error);
      }

      return reports;
    },
  };
}

import "server-only";

import { randomUUID } from "node:crypto";

import type { AuditAction, AuditSource } from "@/lib/dynamodb/entities";
import type { AdminRole } from "@/lib/admin/roles";
import { logger } from "@/lib/logger";

import { putAuditEntry } from "./audit.repository.dynamodb";

/**
 * The admin audit log (ADR-038): one item per admin action.
 *
 * The log holds the staff email and nothing else personal. Writing it must never take the
 * admin down, so a failure is logged and swallowed: the action is not blocked by its record.
 * (Later phases that change data should treat a failed audit write as an error to surface.)
 */
export interface AuditInput {
  actorEmail: string;
  actorRole: AdminRole | null;
  action: AuditAction;
  target?: string;
  requestId: string;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await putAuditEntry(createAuditEntry(input));
  } catch (error) {
    logger.error("Admin audit write failed", {
      action: input.action,
      requestId: input.requestId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

/** Pure: turns an input into the stored shape. Kept apart so it can be tested without AWS. */
export function createAuditEntry(
  input: AuditInput,
  now: Date = new Date(),
  id: string = randomUUID(),
): AuditSource {
  return {
    id,
    timestamp: now.toISOString(),
    actor_email: input.actorEmail,
    actor_role: input.actorRole,
    action: input.action,
    target: input.target ?? null,
    request_id: input.requestId,
  };
}

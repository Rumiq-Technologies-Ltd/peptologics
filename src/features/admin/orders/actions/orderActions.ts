"use server";

import { z } from "zod";

import type { OrderActionResult } from "@/features/admin/orders/actions/actionResult";
import { getOrderAdmin } from "@/features/admin/orders/services/container.server";
import type { OrderChangeOutcome } from "@/features/admin/orders/types";
import { requestId, requireAdmin } from "@/lib/admin/authorize.server";
import type { ServiceFailure, ServiceResult } from "@/types/result";

/**
 * The server actions behind the admin order screens. Each one is thin: check access (Editor or
 * Owner, from our own origin), call the service, answer in plain data.
 * The screens refresh themselves afterwards: admin pages are never cached. Rules live in the service; nothing here trusts what the browser sent.
 */

const idSchema = z.uuid();
const versionSchema = z.number().int().min(0);

async function actor() {
  const session = await requireAdmin({ role: "editor", mutating: true });
  return { email: session.email, role: session.role, requestId: await requestId() };
}

function failure(result: ServiceFailure): OrderActionResult {
  const known = ["VALIDATION_FAILED", "VERSION_CONFLICT", "NOT_FOUND"] as const;
  const code = known.find((candidate) => candidate === result.code) ?? "ERROR";
  return { success: false, message: result.message, code, fieldErrors: result.fieldErrors };
}

function invalid(): OrderActionResult {
  return { success: false, message: "That request was not valid.", code: "VALIDATION_FAILED" };
}

function finish(result: ServiceResult<OrderChangeOutcome>, okMessage: string): OrderActionResult {
  if (!result.success) return failure(result);

  return {
    success: true,
    order: result.data.order,
    message: result.data.changed ? okMessage : "Nothing to save: no changes.",
  };
}

export async function changeOrderStatusAction(
  orderId: string,
  expectedVersion: number,
  status: unknown,
): Promise<OrderActionResult> {
  const who = await actor();
  if (!idSchema.safeParse(orderId).success || !versionSchema.safeParse(expectedVersion).success) {
    return invalid();
  }

  return finish(
    await getOrderAdmin().changeStatus(orderId, status, expectedVersion, who),
    "Status saved.",
  );
}

export async function hideOrderAction(
  orderId: string,
  expectedVersion: number,
): Promise<OrderActionResult> {
  const who = await actor();
  if (!idSchema.safeParse(orderId).success || !versionSchema.safeParse(expectedVersion).success) {
    return invalid();
  }

  return finish(
    await getOrderAdmin().hide(orderId, expectedVersion, who),
    "Order hidden as test or spam.",
  );
}

export async function restoreOrderAction(
  orderId: string,
  expectedVersion: number,
): Promise<OrderActionResult> {
  const who = await actor();
  if (!idSchema.safeParse(orderId).success || !versionSchema.safeParse(expectedVersion).success) {
    return invalid();
  }

  return finish(await getOrderAdmin().restore(orderId, expectedVersion, who), "Order restored.");
}

export async function addOrderNoteAction(
  orderId: string,
  body: unknown,
): Promise<OrderActionResult> {
  const who = await actor();
  if (!idSchema.safeParse(orderId).success) return invalid();

  const result = await getOrderAdmin().addNote(orderId, body, who);
  if (!result.success) return failure(result);

  return { success: true, note: result.data, message: "Note added." };
}

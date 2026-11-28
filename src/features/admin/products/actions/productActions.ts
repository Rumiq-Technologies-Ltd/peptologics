"use server";

import { z } from "zod";

import { revalidateCatalog } from "@/features/admin/products/actions/revalidateCatalog";
import type { ProductActionResult } from "@/features/admin/products/actions/actionResult";
import { getProductAdmin } from "@/features/admin/products/services/container.server";
import type { ProductChangeOutcome } from "@/features/admin/products/types";
import type { ReorderDirection } from "@/features/admin/products/services/productAdmin.service";
import { isAllowedImageType, MAX_IMAGE_BYTES } from "@/features/admin/products/utils/imageRules";
import { recordAudit } from "@/features/admin/services/audit.service";
import { requestId, requireAdmin } from "@/lib/admin/authorize.server";
import type { ServiceFailure, ServiceResult } from "@/types/result";

/**
 * The server actions behind the admin product screens. Each one is thin: check access (Editor
 * or Owner, from our own origin), call the service, refresh the site, answer in plain data.
 * Business rules live in the service; nothing here trusts what the browser sent.
 */

const idSchema = z.uuid();
const versionSchema = z.number().int().min(0);

async function actor() {
  const session = await requireAdmin({ role: "editor", mutating: true });
  return { email: session.email, role: session.role, requestId: await requestId() };
}

function failure(result: ServiceFailure): ProductActionResult {
  const known = ["VALIDATION_FAILED", "VERSION_CONFLICT", "SLUG_TAKEN", "NOT_FOUND"] as const;
  const code = known.find((candidate) => candidate === result.code) ?? "ERROR";
  return { success: false, message: result.message, code, fieldErrors: result.fieldErrors };
}

function invalid(message = "That request was not valid."): ProductActionResult {
  return { success: false, message, code: "VALIDATION_FAILED" };
}

/**
 * Refreshes the pages built from the catalog after a save. The product page needs nothing: it is
 * rendered on every request (ADR-039). The other pages are cached for at most a minute, and this
 * refreshes them in the origin straight away; the edge may still hold one for up to that minute.
 */
async function finish(
  result: ServiceResult<ProductChangeOutcome>,
  okMessage: string,
): Promise<ProductActionResult> {
  if (!result.success) return failure(result);

  revalidateCatalog();
  return { success: true, product: result.data.product, message: okMessage };
}

export async function createProductAction(input: unknown): Promise<ProductActionResult> {
  const who = await actor();
  return finish(await getProductAdmin().products.create(input, who), "Product added.");
}

export async function updateProductAction(
  productId: string,
  expectedVersion: number,
  input: unknown,
): Promise<ProductActionResult> {
  const who = await actor();
  if (!idSchema.safeParse(productId).success || !versionSchema.safeParse(expectedVersion).success) {
    return invalid();
  }

  const result = await getProductAdmin().products.update(productId, input, expectedVersion, who);
  if (result.success && result.data.changedFields.length === 0) {
    return { success: true, product: result.data.product, message: "Nothing to save: no changes." };
  }
  return finish(result, "Saved.");
}

export async function setProductStatusAction(
  productId: string,
  expectedVersion: number,
  target: "archived" | "active",
): Promise<ProductActionResult> {
  const who = await actor();
  if (!idSchema.safeParse(productId).success || !versionSchema.safeParse(expectedVersion).success) {
    return invalid();
  }

  const { products } = getProductAdmin();
  const result =
    target === "archived"
      ? await products.archive(productId, expectedVersion, who)
      : await products.restore(productId, expectedVersion, who);

  return finish(
    result,
    target === "archived"
      ? "Archived. The product is hidden from the shop and can be restored."
      : "Restored. The product is back in the shop.",
  );
}

export async function setProductFeaturedAction(
  productId: string,
  expectedVersion: number,
  featured: boolean,
): Promise<ProductActionResult> {
  const who = await actor();
  if (!idSchema.safeParse(productId).success || !versionSchema.safeParse(expectedVersion).success) {
    return invalid();
  }

  const result = await getProductAdmin().products.update(
    productId,
    { featured: featured === true },
    expectedVersion,
    who,
  );
  return finish(result, featured ? "Marked as featured." : "No longer featured.");
}

export async function reorderProductAction(
  productId: string,
  direction: ReorderDirection,
): Promise<ProductActionResult> {
  const who = await actor();
  if (!idSchema.safeParse(productId).success || (direction !== "up" && direction !== "down")) {
    return invalid();
  }

  const result = await getProductAdmin().products.reorder(productId, direction, who);
  if (!result.success) return failure(result);

  if (result.data.moved) revalidateCatalog();
  return { success: true, message: result.data.moved ? "Order updated." : "Already at the end." };
}

export async function requestImageUploadAction(input: {
  contentType: string;
  size: number;
}): Promise<
  | { success: true; key: string; url: string; headers: Record<string, string> }
  | { success: false; message: string }
> {
  await actor();
  const { images } = getProductAdmin();
  if (!images)
    return { success: false, message: "Image upload is not set up in this environment." };

  if (typeof input?.contentType !== "string" || !isAllowedImageType(input.contentType)) {
    return { success: false, message: "Use a JPEG, PNG or WebP image." };
  }
  if (typeof input.size !== "number" || input.size > MAX_IMAGE_BYTES) {
    return { success: false, message: "The image must be 5 MB or smaller." };
  }

  const ticket = await images.createUploadTicket(input);
  return ticket.success
    ? { success: true, ...ticket.data }
    : { success: false, message: ticket.message };
}

export async function finalizeImageUploadAction(
  key: string,
): Promise<{ success: true; imageUrl: string } | { success: false; message: string }> {
  const who = await actor();
  const { images } = getProductAdmin();
  if (!images)
    return { success: false, message: "Image upload is not set up in this environment." };

  const result = await images.finalizeUpload(String(key));
  if (!result.success) return { success: false, message: result.message };

  await recordAudit({
    actorEmail: who.email,
    actorRole: who.role,
    action: "product_image_uploaded",
    target: result.data.key,
    requestId: who.requestId,
  });

  return { success: true, imageUrl: result.data.imageUrl };
}

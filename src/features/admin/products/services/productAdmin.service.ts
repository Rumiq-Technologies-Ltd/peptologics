import { randomUUID } from "node:crypto";

import {
  productInputSchema,
  toFieldErrors,
  type ProductInput,
  type ProductPatch,
} from "@/features/admin/products/validation/product.schema";
import type {
  AdminActor,
  AdminProduct,
  ProductChangeOutcome,
} from "@/features/admin/products/types";
import { createAuditEntry } from "@/features/admin/services/audit.service";
import {
  buildAuditItem,
  buildLiveSlugGuard,
  buildProductItems,
  buildRetiredSlugGuard,
  type AuditAction,
  type AuditSource,
  type Item,
  type ProductSource,
} from "@/lib/dynamodb/entities";
import { logger } from "@/lib/logger";
import { fail, ok, type ServiceResult } from "@/types/result";

import { bySortOrder, toAdminProduct } from "./productAdmin.mapper";
import {
  MAX_TRANSACTION_ITEMS,
  ProductWriteConflict,
  type ProductAdminRepository,
  type WriteStep,
} from "./productAdmin.repository";

/**
 * Admin product rules (D35, D37): create, edit, archive, restore, reorder.
 *
 * Every change is one transaction: the product, its slug guards and its audit item, so a
 * change cannot happen without its log line. Nothing here is deleted: archive is a status (D37).
 * The service knows nothing about Next.js; the server actions revalidate pages afterwards.
 */

/** Where a new product's display order starts after the last one, and the spacing on reorder. */
export const SORT_ORDER_STEP = 10;

export type ReorderDirection = "up" | "down";

export interface ProductAdminDeps {
  repository: ProductAdminRepository;
  now?: () => Date;
  newId?: () => string;
  /** Checks an image address against the places images may live. Defaults to accepting it. */
  isAllowedImageUrl?: (url: string) => boolean;
}

export interface ProductAdminService {
  list(): Promise<AdminProduct[]>;
  get(productId: string): Promise<AdminProduct | null>;
  create(input: unknown, actor: AdminActor): Promise<ServiceResult<ProductChangeOutcome>>;
  update(
    productId: string,
    patch: unknown,
    expectedVersion: number,
    actor: AdminActor,
    options?: { action?: AuditAction },
  ): Promise<ServiceResult<ProductChangeOutcome>>;
  archive(
    productId: string,
    expectedVersion: number,
    actor: AdminActor,
  ): Promise<ServiceResult<ProductChangeOutcome>>;
  restore(
    productId: string,
    expectedVersion: number,
    actor: AdminActor,
  ): Promise<ServiceResult<ProductChangeOutcome>>;
  reorder(
    productId: string,
    direction: ReorderDirection,
    actor: AdminActor,
  ): Promise<ServiceResult<{ moved: boolean; slugs: string[] }>>;
}

const FIELD_LABELS = [
  "name",
  "slug",
  "description",
  "category",
  "strength",
  "strengthUnit",
  "price",
  "status",
  "featured",
  "sortOrder",
  "imageUrl",
] as const;

/** The editable fields of a stored product, in the form's own terms. */
function toInput(product: AdminProduct): ProductInput {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description ?? undefined,
    category: product.category,
    strength: product.strength,
    strengthUnit: product.strengthUnit,
    price: product.priceCents / 100,
    status: product.status,
    featured: product.featured,
    sortOrder: product.sortOrder,
    imageUrl: product.imageUrl ?? undefined,
  };
}

/** Each field that differs, as before and after. Price is compared and logged in cents. */
export function diffProduct(
  before: ProductInput,
  after: ProductInput,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  for (const field of FIELD_LABELS) {
    const from = field === "price" ? Math.round(before.price * 100) : before[field];
    const to = field === "price" ? Math.round(after.price * 100) : after[field];

    if (from !== to) {
      changes[field === "price" ? "priceCents" : field] = { from: from ?? null, to: to ?? null };
    }
  }

  return changes;
}

function toSource(
  id: string,
  input: ProductInput,
  extra: { version: number; createdAt: string; updatedAt: string; previousSlugs: string[] },
): ProductSource {
  return {
    id,
    slug: input.slug,
    name: input.name,
    description: input.description || null,
    category: input.category,
    strength_mg: input.strength,
    strength_unit: input.strengthUnit,
    price_cents: Math.round(input.price * 100),
    is_blend: input.category === "blend",
    featured: input.featured,
    sort_order: input.sortOrder,
    image_url: input.imageUrl ?? null,
    status: input.status,
    created_at: extra.createdAt,
    updated_at: extra.updatedAt,
    version: extra.version,
    previous_slugs: extra.previousSlugs,
  };
}

/** The condition that makes a write fail if somebody else saved first. */
function versionCondition(expected: number): WriteStep["condition"] {
  return expected === 0
    ? { expression: "attribute_not_exists(#v)", names: { "#v": "version" } }
    : { expression: "#v = :v", names: { "#v": "version" }, values: { ":v": expected } };
}

export function createProductAdminService({
  repository,
  now = () => new Date(),
  newId = randomUUID,
  isAllowedImageUrl = () => true,
}: ProductAdminDeps): ProductAdminService {
  function audit(
    actor: AdminActor,
    action: AuditAction,
    target: string,
    changes: AuditSource["changes"],
    at: Date,
  ): Item {
    return buildAuditItem(
      createAuditEntry(
        {
          actorEmail: actor.email,
          actorRole: actor.role,
          action,
          target,
          changes,
          requestId: actor.requestId,
        },
        at,
      ),
    );
  }

  function validate(value: unknown): ServiceResult<ProductInput> {
    const parsed = productInputSchema.safeParse(value);
    if (parsed.success) return ok(parsed.data);

    return fail("VALIDATION_FAILED", "Check the highlighted fields and try again.", {
      fieldErrors: toFieldErrors(parsed.error),
    });
  }

  function imageProblem(input: ProductInput): ServiceResult<never> | null {
    if (input.imageUrl && !isAllowedImageUrl(input.imageUrl)) {
      return fail("VALIDATION_FAILED", "Check the highlighted fields and try again.", {
        fieldErrors: { imageUrl: ["That image is not from this site's image store."] },
      });
    }
    return null;
  }

  async function commit(steps: WriteStep[]): Promise<ServiceResult<null>> {
    try {
      await repository.commit(steps);
      return ok(null);
    } catch (error) {
      if (error instanceof ProductWriteConflict) {
        if (error.kind === "slug_taken") {
          return fail("SLUG_TAKEN", "That web address is already used by another product.", {
            fieldErrors: { slug: ["That web address is already used by another product."] },
          });
        }
        return fail("VERSION_CONFLICT", "This product changed since you opened it. Reload.");
      }
      logger.error("admin_product_write_failed", { error });
      return fail("PERSISTENCE_FAILED", "Unable to save the product. Please try again.");
    }
  }

  const service: ProductAdminService = {
    async list(): Promise<AdminProduct[]> {
      return (await repository.listItems()).map(toAdminProduct).sort(bySortOrder);
    },

    async get(productId): Promise<AdminProduct | null> {
      const item = await repository.getItem(productId);
      return item ? toAdminProduct(item) : null;
    },

    async create(rawInput, actor): Promise<ServiceResult<ProductChangeOutcome>> {
      const validated = validate(rawInput);
      if (!validated.success) return validated;

      const input = validated.data;
      const badImage = imageProblem(input);
      if (badImage) return badImage;

      const at = now();
      const id = newId();
      const stamp = at.toISOString();
      const [item, guard] = buildProductItems(
        toSource(id, input, { version: 1, createdAt: stamp, updatedAt: stamp, previousSlugs: [] }),
        stamp,
      ) as [Item, Item];

      const written = await commit([
        { item, condition: { expression: "attribute_not_exists(PK)" }, onConflict: "exists" },
        {
          item: guard,
          condition: { expression: "attribute_not_exists(PK)" },
          onConflict: "slug_taken",
        },
        {
          item: audit(
            actor,
            "product_created",
            id,
            {
              name: { from: null, to: input.name },
              slug: { from: null, to: input.slug },
              status: { from: null, to: input.status },
            },
            at,
          ),
        },
      ]);
      if (!written.success) return written;

      return ok({
        product: toAdminProduct(item),
        changedFields: ["created"],
        staleSlugs: [],
        needsBuild: true,
      });
    },

    async update(
      productId,
      rawPatch,
      expectedVersion,
      actor,
      options = {},
    ): Promise<ServiceResult<ProductChangeOutcome>> {
      const existingItem = await repository.getItem(productId);
      if (!existingItem) return fail("NOT_FOUND", "That product no longer exists.");

      const existing = toAdminProduct(existingItem);
      if (existing.version !== expectedVersion) {
        return fail("VERSION_CONFLICT", "This product changed since you opened it. Reload.");
      }

      const before = toInput(existing);
      const validated = validate({ ...before, ...(rawPatch as ProductPatch) });
      if (!validated.success) return validated;

      const after = validated.data;
      const badImage = imageProblem(after);
      if (badImage) return badImage;

      const changes = diffProduct(before, after);
      const changedFields = Object.keys(changes);
      if (changedFields.length === 0) {
        return ok({ product: existing, changedFields: [], staleSlugs: [], needsBuild: false });
      }

      const at = now();
      const stamp = at.toISOString();
      const slugChanged = after.slug !== existing.slug;

      // A retired slug this product takes back is no longer retired.
      const previousSlugs = slugChanged
        ? [...existing.previousSlugs.filter((slug) => slug !== after.slug), existing.slug]
        : existing.previousSlugs;

      const [item] = buildProductItems(
        toSource(productId, after, {
          version: existing.version + 1,
          createdAt: existing.createdAt,
          updatedAt: stamp,
          previousSlugs,
        }),
        stamp,
      ) as [Item, Item];

      const ownsGuard = {
        expression: "attribute_not_exists(PK) OR product_id = :pid",
        values: { ":pid": productId },
      };

      const steps: WriteStep[] = [
        { item, condition: versionCondition(existing.version), onConflict: "version" },
      ];

      if (slugChanged) {
        steps.push(
          {
            item: buildLiveSlugGuard(after.slug, productId),
            condition: ownsGuard,
            onConflict: "slug_taken",
          },
          {
            item: buildRetiredSlugGuard(existing.slug, productId, stamp),
            condition: ownsGuard,
            onConflict: "exists",
          },
        );
      }

      const action: AuditAction = options.action ?? "product_updated";
      steps.push({ item: audit(actor, action, productId, changes, at) });

      const written = await commit(steps);
      if (!written.success) return written;

      return ok({
        product: toAdminProduct(item),
        changedFields,
        staleSlugs: slugChanged ? [existing.slug] : [],
        needsBuild: slugChanged,
      });
    },

    archive(productId, expectedVersion, actor) {
      return service.update(productId, { status: "archived" }, expectedVersion, actor, {
        action: "product_archived",
      });
    },

    restore(productId, expectedVersion, actor) {
      return service.update(productId, { status: "active" }, expectedVersion, actor, {
        action: "product_restored",
      });
    },

    async reorder(
      productId,
      direction,
      actor,
    ): Promise<ServiceResult<{ moved: boolean; slugs: string[] }>> {
      const products = await service.list();
      const index = products.findIndex((product) => product.id === productId);
      if (index < 0) return fail("NOT_FOUND", "That product no longer exists.");

      const neighbourIndex = direction === "up" ? index - 1 : index + 1;
      if (neighbourIndex < 0 || neighbourIndex >= products.length) {
        return ok({ moved: false, slugs: [] });
      }

      const reordered = [...products];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(neighbourIndex, 0, moved as AdminProduct);

      // Evenly spaced orders: ties and gaps from older data are repaired as a side effect,
      // and only products whose order actually changes are written.
      const changed = reordered
        .map((product, position) => ({ product, sortOrder: (position + 1) * SORT_ORDER_STEP }))
        .filter(({ product, sortOrder }) => product.sortOrder !== sortOrder);

      if (changed.length + 1 > MAX_TRANSACTION_ITEMS) {
        return fail("PERSISTENCE_FAILED", "There are too many products to reorder in one step.");
      }

      const at = now();
      const stamp = at.toISOString();
      const steps: WriteStep[] = changed.map(({ product, sortOrder }) => {
        const [item] = buildProductItems(
          toSource(
            product.id,
            { ...toInput(product), sortOrder },
            {
              version: product.version + 1,
              createdAt: product.createdAt,
              updatedAt: stamp,
              previousSlugs: product.previousSlugs,
            },
          ),
          stamp,
        ) as [Item, Item];

        return {
          item,
          condition: versionCondition(product.version),
          onConflict: "version" as const,
        };
      });

      const movedProduct = products[index] as AdminProduct;
      const newOrder = changed.find(({ product }) => product.id === productId)?.sortOrder;
      steps.push({
        item: audit(
          actor,
          "product_reordered",
          productId,
          {
            sortOrder: { from: movedProduct.sortOrder, to: newOrder ?? movedProduct.sortOrder },
          },
          at,
        ),
      });

      const written = await commit(steps);
      if (!written.success) return written;

      return ok({ moved: true, slugs: changed.map(({ product }) => product.slug) });
    },
  };

  return service;
}

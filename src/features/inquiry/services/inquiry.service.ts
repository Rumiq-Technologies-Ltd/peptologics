import "server-only";

import { MIN_FORM_DWELL_SECONDS } from "@/constants/business";
import { MESSAGES } from "@/constants/messages";
import type { OrderRepository } from "@/features/inquiry/services/order.repository";
import type { RateLimitService } from "@/features/inquiry/services/rate-limit.service";
import type { InquiryLineItem, InquiryResult } from "@/features/inquiry/types/inquiry";
import type { ProductRepository } from "@/features/products/services/product.repository";
import type { Product } from "@/features/products/types/product";
import { logger } from "@/lib/logger";
import type { InquiryInput } from "@/lib/validations/inquiry.schema";
import type { NotificationService } from "@/services/notification.service";
import { fail, ok, type ServiceResult } from "@/types/result";

/**
 * The inquiry submission flow, in one place.
 *
 * Order of operations is the design, not an implementation detail:
 *
 * ```
 * spam filters  →  rate limit  →  price authority  →  atomic persist  →  notify
 * ```
 *
 * Spam first, because a bot must cost us nothing — no database round trip, no
 * counter increment. Rate limit next, before any real work. Then the server reads
 * `products.price_cents` itself, because the request contains no prices and never
 * will (ADR-005). Persistence is a single RPC so the order, its items and both
 * notification intents commit together (ADR-004). Notifications run **after** the
 * commit and cannot affect it.
 *
 * The service returns `ServiceResult` rather than throwing: a rate-limited or
 * unavailable-product submission is an expected outcome, and the Route Handler maps
 * each code onto a status without a try/catch of its own.
 */

export interface InquiryService {
  submit(input: InquiryInput, context: SubmitContext): Promise<ServiceResult<InquiryResult>>;
}

export interface SubmitContext {
  /** Client-generated UUID from the `Idempotency-Key` header. */
  idempotencyKey: string;
  /** Salted hash of the client IP. Never a raw address. */
  clientKey: string;
}

export interface InquiryServiceDeps {
  orders: OrderRepository;
  products: ProductRepository;
  rateLimit: RateLimitService;
  notifications: NotificationService;
}

/**
 * The response a suppressed submission receives.
 *
 * Identical in shape to a real success and indistinguishable from one over the wire.
 * A bot that is told "rejected" learns which signal caught it and adapts; a bot that
 * is told "thank you" learns nothing and keeps posting into a void.
 */
const SUPPRESSED_RESULT: InquiryResult = { orderNumber: null, created: false };

export function createInquiryService({
  orders,
  products,
  rateLimit,
  notifications,
}: InquiryServiceDeps): InquiryService {
  /**
   * Prices the requested lines from the catalog.
   *
   * `findByIds` reads through the publishable key, so RLS has already narrowed the
   * result to `status = 'active' AND deleted_at IS NULL`. Anything the visitor asked
   * for that is missing from the result is unavailable — archived, out of stock, or
   * never real — and the whole submission is refused rather than quietly trimmed.
   * Sending a quotation that silently omits a line the customer asked for is worse
   * than asking them to review the list.
   */
  function priceLines(
    input: InquiryInput,
    catalog: readonly Product[],
  ): { lines: InquiryLineItem[]; subtotalCents: number } | null {
    const byId = new Map(catalog.map((product) => [product.id, product]));
    const lines: InquiryLineItem[] = [];
    let subtotalCents = 0;

    for (const item of input.items) {
      const product = byId.get(item.productId);
      if (!product) return null;

      const lineTotal = product.priceCents * item.quantity;

      lines.push({
        productId: product.id,
        // Snapshot, so a later rename or repricing cannot rewrite this inquiry.
        productName: product.name,
        productSlug: product.slug,
        strengthMg: product.strengthMg,
        quantity: item.quantity,
        unitPriceCents: product.priceCents,
        subtotalCents: lineTotal,
      });

      subtotalCents += lineTotal;
    }

    return { lines, subtotalCents };
  }

  /** True when the submission carries a bot's fingerprints. */
  function isSuppressed(input: InquiryInput): { suppressed: boolean; reason?: string } {
    // Hidden from people, visible to anything that fills every input it finds.
    if (input.honeypot && input.honeypot.trim().length > 0) {
      return { suppressed: true, reason: "honeypot" };
    }

    /*
     * Our own form always sends `formStartedAt`, so an absent field means the caller
     * is not our form. Treated as a failed dwell check rather than waved through:
     * omitting a field must not be an easier bypass than forging it.
     */
    if (input.formStartedAt === undefined) {
      return { suppressed: true, reason: "dwell_missing" };
    }

    const dwellSeconds = (Date.now() - input.formStartedAt) / 1000;

    // A negative dwell means a forged or clock-skewed timestamp.
    if (dwellSeconds < MIN_FORM_DWELL_SECONDS) {
      return { suppressed: true, reason: "dwell_too_short" };
    }

    return { suppressed: false };
  }

  return {
    async submit(input, context): Promise<ServiceResult<InquiryResult>> {
      const spam = isSuppressed(input);

      if (spam.suppressed) {
        // Logged with the reason so genuine false positives are diagnosable, but
        // without customer data: a suppressed payload is far more likely to be
        // junk than a person, and we have no reason to retain it.
        logger.warn("inquiry_suppressed", { reason: spam.reason, itemCount: input.items.length });
        return ok(SUPPRESSED_RESULT);
      }

      // Schema-guaranteed, re-checked because this service must be correct for any
      // caller, not only the one Route Handler that exists today.
      if (input.items.length === 0) {
        return fail("EMPTY_SELECTION", MESSAGES.inquiry.emptySelection);
      }

      const verdict = await rateLimit.checkInquiry(context.clientKey);

      if (!verdict.allowed) {
        logger.warn("inquiry_rate_limited", {
          hitCount: verdict.hitCount,
          limit: verdict.limit,
        });

        return fail("RATE_LIMITED", MESSAGES.inquiry.rateLimited, {
          retryAfterSeconds: verdict.retryAfterSeconds,
        });
      }

      let priced: { lines: InquiryLineItem[]; subtotalCents: number } | null;

      try {
        const catalog = await products.findByIds(input.items.map((item) => item.productId));
        priced = priceLines(input, catalog);
      } catch (error) {
        logger.error("inquiry_pricing_failed", { error });
        return fail("UNEXPECTED", MESSAGES.inquiry.failed);
      }

      if (!priced) {
        return fail("PRODUCT_UNAVAILABLE", MESSAGES.inquiry.unavailable);
      }

      let receipt;

      try {
        receipt = await orders.create({
          idempotencyKey: context.idempotencyKey,
          customer: input.customer,
          items: priced.lines,
          subtotalCents: priced.subtotalCents,
          ruoAcknowledgedAt: input.ruoAcknowledgedAt,
        });
      } catch (error) {
        logger.error("inquiry_persist_failed", { error, itemCount: priced.lines.length });
        return fail("PERSISTENCE_FAILED", MESSAGES.inquiry.failed);
      }

      logger.info("inquiry_created", {
        orderId: receipt.orderId,
        orderNumber: receipt.orderNumber,
        created: receipt.created,
        itemCount: priced.lines.length,
        subtotalCents: priced.subtotalCents,
      });

      if (!receipt.created) {
        /*
         * A replayed idempotency key: a double-click, or a retry after a response was
         * lost. The order already exists and was already notified, so notifying again
         * would put a second copy of the same lead in the operator's inbox. The
         * customer still gets the original confirmation.
         */
        logger.info("inquiry_replayed", { orderNumber: receipt.orderNumber });

        return ok({ orderNumber: receipt.orderNumber, created: false });
      }

      /*
       * Awaited, not fired and forgotten. A serverless invocation can be frozen the
       * moment its response is returned, which would kill an unawaited dispatch
       * partway through and leave the log rows `pending`. The notification service
       * cannot throw, so awaiting it risks nothing but a second or so of latency.
       */
      await notifications.dispatch({
        orderId: receipt.orderId,
        orderNumber: receipt.orderNumber,
        customer: input.customer,
        items: priced.lines,
        subtotalCents: priced.subtotalCents,
      });

      return ok({ orderNumber: receipt.orderNumber, created: true });
    },
  };
}

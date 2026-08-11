import { beforeEach, describe, expect, it, vi } from "vitest";

import { MIN_FORM_DWELL_SECONDS } from "@/constants/business";
import { createInquiryService } from "@/features/inquiry/services/inquiry.service";
import type { OrderRepository } from "@/features/inquiry/services/order.repository";
import type { RateLimitService } from "@/features/inquiry/services/rate-limit.service";
import type { CreateInquiryPayload } from "@/features/inquiry/types/inquiry";
import type { ProductRepository } from "@/features/products/services/product.repository";
import type { Product } from "@/features/products/types/product";
import type { InquiryInput } from "@/lib/validations/inquiry.schema";
import type { NotificationService } from "@/services/notification.service";
import { makeCustomer, makeProduct } from "@/test/factories";

/**
 * The inquiry submission flow.
 *
 * Every dependency is injected, so this exercises the real service against fakes with
 * no database, no network and no mocked module resolution — which is the whole reason
 * the composition root exists.
 *
 * The order of the checks is itself behaviour worth pinning: a bot must not reach the
 * rate limiter, and the rate limiter must not reach the catalog.
 */

const retatrutide = makeProduct({ name: "Retatrutide", priceCents: 6000, strengthMg: 10 });

/** Long enough ago to pass the dwell check. */
function dwellPassing(): number {
  return Date.now() - (MIN_FORM_DWELL_SECONDS + 5) * 1000;
}

function makeInput(overrides: Partial<InquiryInput> = {}): InquiryInput {
  return {
    customer: makeCustomer() as InquiryInput["customer"],
    items: [{ productId: retatrutide.id, quantity: 2 }],
    formStartedAt: dwellPassing(),
    // Present and undefined rather than absent: the schema output type has this key,
    // so omitting it would make the fixture a different shape from a real payload.
    couponCode: undefined,
    ...overrides,
  };
}

interface Harness {
  service: ReturnType<typeof createInquiryService>;
  create: ReturnType<typeof vi.fn>;
  dispatch: ReturnType<typeof vi.fn>;
  checkInquiry: ReturnType<typeof vi.fn>;
  findByIds: ReturnType<typeof vi.fn>;
}

function makeHarness(options: { catalog?: Product[]; created?: boolean } = {}): Harness {
  const catalog = options.catalog ?? [retatrutide];

  const findByIds = vi.fn(async (ids: readonly string[]) =>
    catalog.filter((product) => ids.includes(product.id)),
  );

  const create = vi.fn(async () => ({
    orderId: "order-1",
    orderNumber: "PL-001000",
    created: options.created ?? true,
  }));

  const checkInquiry = vi.fn(async () => ({
    allowed: true,
    hitCount: 1,
    limit: 5,
    retryAfterSeconds: 900,
  }));

  const dispatch = vi.fn(async () => []);

  const service = createInquiryService({
    orders: { create } as unknown as OrderRepository,
    products: { findByIds } as unknown as ProductRepository,
    rateLimit: { checkInquiry } as unknown as RateLimitService,
    notifications: { dispatch } as unknown as NotificationService,
  });

  return { service, create, dispatch, checkInquiry, findByIds };
}

const context = { idempotencyKey: "11111111-2222-4333-8444-555555555555", clientKey: "hashed-ip" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("price authority", () => {
  it("prices every line from the catalog and computes the subtotal server-side", async () => {
    const { service, create } = makeHarness();

    const result = await service.submit(makeInput(), context);

    expect(result.success).toBe(true);

    const payload = create.mock.calls[0]?.[0] as CreateInquiryPayload;
    expect(payload.subtotalCents).toBe(12_000);
    expect(payload.items[0]).toMatchObject({
      unitPriceCents: 6000,
      subtotalCents: 12_000,
      quantity: 2,
    });
  });

  it("snapshots the product name, slug and strength onto the line", async () => {
    const { service, create } = makeHarness();

    await service.submit(makeInput(), context);

    const payload = create.mock.calls[0]?.[0] as CreateInquiryPayload;
    expect(payload.items[0]).toMatchObject({
      productName: "Retatrutide",
      productSlug: retatrutide.slug,
      strengthMg: 10,
    });
  });

  it("refuses the whole inquiry when a product is unavailable, rather than trimming it", async () => {
    const { service, create } = makeHarness();

    const result = await service.submit(
      makeInput({
        items: [
          { productId: retatrutide.id, quantity: 1 },
          { productId: "99999999-9999-4999-8999-999999999999", quantity: 1 },
        ],
      }),
      context,
    );

    expect(result.success).toBe(false);
    expect(result.success === false && result.code).toBe("PRODUCT_UNAVAILABLE");
    expect(create).not.toHaveBeenCalled();
  });
});

describe("spam suppression", () => {
  it.each([
    ["a filled honeypot", { honeypot: "https://spam.example" }],
    ["an instant submission", { formStartedAt: Date.now() }],
    ["a missing dwell timestamp", { formStartedAt: undefined }],
    ["a future-dated dwell timestamp", { formStartedAt: Date.now() + 60_000 }],
  ])("answers %s with an ordinary success and persists nothing", async (_label, overrides) => {
    const { service, create, dispatch, checkInquiry } = makeHarness();

    const result = await service.submit(makeInput(overrides as Partial<InquiryInput>), context);

    // Indistinguishable from a real success over the wire (ADR-021).
    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual({ orderNumber: null, created: false });

    expect(create).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    // A bot must not even cost us a counter increment.
    expect(checkInquiry).not.toHaveBeenCalled();
  });

  it("lets an ordinary submission through", async () => {
    const { service, create } = makeHarness();

    const result = await service.submit(makeInput({ honeypot: "" }), context);

    expect(result.success && result.data.orderNumber).toBe("PL-001000");
    expect(create).toHaveBeenCalledOnce();
  });
});

describe("rate limiting", () => {
  it("returns RATE_LIMITED with the retry window and never reaches the catalog", async () => {
    const { service, checkInquiry, findByIds, create } = makeHarness();
    checkInquiry.mockResolvedValueOnce({
      allowed: false,
      hitCount: 6,
      limit: 5,
      retryAfterSeconds: 88,
    });

    const result = await service.submit(makeInput(), context);

    expect(result.success).toBe(false);
    expect(result.success === false && result.code).toBe("RATE_LIMITED");
    expect(result.success === false && result.retryAfterSeconds).toBe(88);
    expect(findByIds).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});

describe("idempotent replay", () => {
  it("returns the original order and does not notify a second time", async () => {
    const { service, dispatch } = makeHarness({ created: false });

    const result = await service.submit(makeInput(), context);

    expect(result.success && result.data).toEqual({ orderNumber: "PL-001000", created: false });
    // The operator must not receive the same lead twice.
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("passes the caller's idempotency key straight through to the write", async () => {
    const { service, create } = makeHarness();

    await service.submit(makeInput(), context);

    const payload = create.mock.calls[0]?.[0] as CreateInquiryPayload;
    expect(payload.idempotencyKey).toBe(context.idempotencyKey);
  });
});

describe("failure handling", () => {
  it("maps a repository throw onto PERSISTENCE_FAILED with a safe message", async () => {
    const { service, create, dispatch } = makeHarness();
    create.mockRejectedValueOnce(new Error('relation "orders" does not exist'));

    const result = await service.submit(makeInput(), context);

    expect(result.success).toBe(false);
    expect(result.success === false && result.code).toBe("PERSISTENCE_FAILED");
    // The Postgres detail must not survive into anything a customer could read.
    expect(result.success === false && result.message).not.toContain("relation");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("maps a catalog read failure onto UNEXPECTED without persisting", async () => {
    const { service, findByIds, create } = makeHarness();
    findByIds.mockRejectedValueOnce(new Error("connection reset"));

    const result = await service.submit(makeInput(), context);

    expect(result.success === false && result.code).toBe("UNEXPECTED");
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an empty selection even though the schema also guards it", async () => {
    const { service } = makeHarness();

    const result = await service.submit(makeInput({ items: [] }), context);

    expect(result.success === false && result.code).toBe("EMPTY_SELECTION");
  });
});

describe("notification isolation", () => {
  it("still reports success when dispatch reports every channel failed", async () => {
    const { service, dispatch } = makeHarness();
    dispatch.mockResolvedValueOnce([
      { channel: "email", status: "failed", attempts: 3, errorMessage: "Resend 500" },
    ]);

    const result = await service.submit(makeInput(), context);

    // The order is committed before dispatch. A dead provider must never lose a lead.
    expect(result.success).toBe(true);
    expect(result.success && result.data.orderNumber).toBe("PL-001000");
  });

  it("dispatches after the write, with the server-priced lines", async () => {
    const { service, dispatch } = makeHarness();

    await service.submit(makeInput(), context);

    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({
      orderId: "order-1",
      orderNumber: "PL-001000",
      subtotalCents: 12_000,
    });
  });
});

/**
 * Coupons, from the service's point of view.
 *
 * The property under test is the same one that governs prices: the request carries a
 * claim, the server decides what it is worth. A payload cannot express an amount, so
 * these check that the amount stored is the one the server derived.
 */
describe("coupons", () => {
  it("applies a known code against the server's own subtotal", async () => {
    const { service, create } = makeHarness();

    await service.submit(makeInput({ couponCode: "RESEARCH2026" }), context);

    // Two vials at $60: $120 subtotal, 15% is $18.
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      subtotalCents: 12_000,
      couponCode: "RESEARCH2026",
      discountCents: 1_800,
    });
  });

  it("accepts the code however it was typed", async () => {
    const { service, create } = makeHarness();

    await service.submit(makeInput({ couponCode: "  research2026 " }), context);

    expect(create.mock.calls[0]?.[0]).toMatchObject({
      couponCode: "RESEARCH2026",
      discountCents: 1_800,
    });
  });

  it("stores no coupon and no discount for an unrecognised code", async () => {
    const { service, create } = makeHarness();

    const result = await service.submit(makeInput({ couponCode: "NOTACODE" }), context);

    // Still a success: a mistyped code must not reject a filled-in inquiry.
    expect(result.success).toBe(true);
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      couponCode: undefined,
      discountCents: 0,
    });
  });

  it("records a zero discount when no code was entered at all", async () => {
    const { service, create } = makeHarness();

    await service.submit(makeInput(), context);

    expect(create.mock.calls[0]?.[0]).toMatchObject({
      couponCode: undefined,
      discountCents: 0,
    });
  });

  it("tells the notification the discounted total, not just the subtotal", async () => {
    const { service, dispatch } = makeHarness();

    await service.submit(makeInput({ couponCode: "RESEARCH2026" }), context);

    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({
      subtotalCents: 12_000,
      discountCents: 1_800,
      totalCents: 10_200,
    });
  });
});

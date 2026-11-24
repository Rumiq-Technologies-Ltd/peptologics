import type { CreateInquiryPayload } from "@/features/inquiry/types/inquiry";

/** A valid inquiry payload for repository and invariant tests. */
export function validPayload(overrides: Partial<CreateInquiryPayload> = {}): CreateInquiryPayload {
  return {
    idempotencyKey: "3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b",
    customer: {
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "5551234567",
      address: "1 Main Street",
      apartment: undefined,
      city: "Austin",
      state: "TX",
      zipCode: "78701",
      notes: undefined,
    },
    items: [
      {
        productId: "11111111-1111-4111-8111-111111111111",
        productName: "BPC-157",
        productSlug: "bpc-157-10mg",
        strengthMg: 10,
        quantity: 2,
        unitPriceCents: 5000,
        subtotalCents: 10000,
      },
    ],
    subtotalCents: 10000,
    discountCents: 0,
    ...overrides,
  };
}

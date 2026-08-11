import type { Product } from "@/features/products/types/product";

/**
 * Test data builders.
 *
 * Minimal and predictable, per CLAUDE.md: a factory with sensible defaults and an
 * override bag, so each test states only the field it actually cares about. A test that
 * spells out twelve product properties to assert on one of them hides its own point.
 */

let sequence = 0;

/** Deterministic UUIDs, so a failure message points at a recognisable id. */
function nextId(): string {
  sequence += 1;
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

export function makeProduct(overrides: Partial<Product> = {}): Product {
  const id = overrides.id ?? nextId();

  return {
    id,
    slug: "retatrutide-10mg",
    name: "Retatrutide",
    description: null,
    category: "peptide",
    strengthMg: 10,
    strengthUnit: "mg",
    priceCents: 6000,
    costPerMg: 6,
    isBlend: false,
    featured: false,
    sortOrder: 0,
    imageUrl: null,
    coaUrl: null,
    status: "active",
    ...overrides,
  };
}

/** The customer block of a valid inquiry, already in its post-schema (output) shape. */
export function makeCustomer(overrides: Record<string, string | undefined> = {}) {
  return {
    name: "Ada Lovelace",
    email: "ada@example.com",
    phone: "+15550102030",
    address: "12 Analytical Engine Way",
    apartment: undefined,
    city: "Cambridge",
    state: "MA",
    zipCode: "02139",
    notes: undefined,
    ...overrides,
  };
}

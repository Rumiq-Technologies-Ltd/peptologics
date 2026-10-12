import type { Metadata } from "next";

import { Section } from "@/components/layout/Section";
import { ROUTES } from "@/constants/routes";
import { CartView } from "@/features/cart/components/CartView";
import { getContainer } from "@/services/container";

/**
 * The inquiry list.
 *
 * A Server Component that reads the whole active catalog and hands it to a client
 * body. The persisted list holds product IDs only, so the join happens here against
 * live data: prices are always current, and a product withdrawn since the visitor
 * added it simply has no row to render (ADR-010).
 *
 * No route-level `loading.tsx`. The catalog is prerendered, so nothing on the server
 * side is ever waited for — and on a prerendered route the fallback is never replaced
 * (ADR-017). The one real wait is reading `localStorage` after hydration, which
 * `CartView` covers with its own skeleton.
 */

/** One hour. Must be a literal — see the note in ../products/page.tsx (ADR-015). */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Your Inquiry List",
  description:
    "Review the research compounds on your inquiry list and request a quotation. No payment is taken on this website.",
  alternates: { canonical: ROUTES.cart },
  // A per-visitor working surface with nothing to index, and no crawler carries the
  // localStorage that fills it.
  robots: { index: false, follow: true },
};

export default async function CartPage() {
  const result = await getContainer().products.listActive();

  // Thrown rather than rendered, for the reason given on the catalog page. The saved list
  // lives on the device, so the error boundary's retry brings it back without loss.
  if (!result.success) {
    throw new Error(result.message);
  }

  return (
    <Section>
      <h1 className="text-display text-ink-950 font-bold">Your inquiry list</h1>

      <p className="text-lead text-ink-600 mt-4 max-w-2xl">
        Adjust quantities, then request a quotation. A representative confirms availability, lot
        documentation and final pricing — nothing is charged here.
      </p>

      <CartView catalog={result.data} />
    </Section>
  );
}

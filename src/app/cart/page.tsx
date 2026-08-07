import type { Metadata } from "next";
import Link from "next/link";

import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
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

  return (
    <Section>
      <h1 className="text-display text-ink-950 font-bold">Your inquiry list</h1>

      <p className="text-lead text-ink-600 mt-4 max-w-2xl">
        Adjust quantities, then request a quotation. A representative confirms availability, lot
        documentation and final pricing — nothing is charged here.
      </p>

      {result.success ? (
        <CartView catalog={result.data} />
      ) : (
        /*
          Without the catalog, a saved list cannot be resolved — and showing "your
          list is empty" would be a lie that invites the visitor to rebuild it. Say
          what actually happened instead.
        */
        <div className="border-ink-200 mt-10 rounded-xl border bg-white p-8">
          <p className="text-ink-950 font-semibold">{MESSAGES.products.loadFailed}</p>
          <p className="text-ink-600 mt-1 text-sm">
            Your selection is saved on this device and will reappear once the catalog loads.
          </p>

          <Button asChild variant="outline" className="mt-6">
            <Link href={ROUTES.products}>Back to the catalog</Link>
          </Button>
        </div>
      )}
    </Section>
  );
}

import type { Metadata } from "next";

import { Section } from "@/components/layout/Section";
import { OrderSummaryPanel } from "@/features/cart/components/OrderSummaryPanel";
import { ProductRowControls } from "@/features/cart/components/ProductRowControls";
import { StickyOrderBar } from "@/features/cart/components/StickyOrderBar";
import { ProductRow, ProductRowHeader } from "@/features/products/components/ProductRow";
import { MESSAGES } from "@/constants/messages";
import { ROUTES } from "@/constants/routes";
import { getContainer } from "@/services/container";

/**
 * The catalog.
 *
 * A Server Component reading through the service layer — no client-side fetch and
 * no HTTP hop to our own API. Statically rendered and revalidated hourly, so a
 * visitor gets CDN-served HTML and a price change propagates within the hour (or
 * immediately via POST /api/revalidate).
 *
 * Quantity controls and the inquiry-list panel are client leaves inside an otherwise
 * server-rendered page. Search and filtering arrive later; when they do they will
 * read `searchParams` and make this route dynamic, at which point a scoped
 * `<Suspense>` boundary around the list becomes worthwhile (ADR-017).
 */

/**
 * One hour, inlined as a literal.
 *
 * Segment config exports must be statically analyzable — Next cannot read an
 * imported constant or an expression like `60 * 60`, and a non-literal value fails
 * the build with "Invalid segment configuration export detected". Keep this in step
 * with the other catalog routes if it changes.
 */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Research Peptides",
  description:
    "Lyophilized research peptides with list pricing and cost per milligram. Build an inquiry list and request a quotation. For laboratory research use only.",
  alternates: { canonical: ROUTES.products },
};

export default async function ProductsPage() {
  const result = await getContainer().products.listActive();

  // The service returns a failure rather than throwing, so a database outage
  // renders a friendly page instead of hitting the error boundary.
  if (!result.success) {
    return (
      <Section>
        <h1 className="text-h2 text-ink-950 font-bold">Research Peptides</h1>
        <p className="text-ink-600 mt-4">{result.message}</p>
      </Section>
    );
  }

  const products = result.data;

  return (
    <Section lattice>
      <p className="text-eyebrow text-brand-800 uppercase">Catalog</p>
      <div className="brand-rule mt-3 h-0.5 w-24" aria-hidden="true" />

      <h1 className="text-display text-ink-950 mt-6 font-bold">Research Peptides</h1>

      <p className="text-lead text-ink-600 mt-5 max-w-2xl">
        List pricing shown with cost per milligram, so value is comparable across vial sizes. A
        representative confirms availability and final pricing for every inquiry.
      </p>

      {products.length === 0 ? (
        <div className="border-ink-200 mt-12 rounded-lg border bg-white p-8">
          <p className="text-ink-950 font-semibold">{MESSAGES.products.empty}</p>
          <p className="text-ink-600 mt-1 text-sm">{MESSAGES.products.emptyDetail}</p>
        </div>
      ) : (
        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_21rem] lg:gap-12">
          <div>
            <div className="border-ink-200 shadow-panel rounded-xl border bg-white p-5 sm:p-6">
              <ProductRowHeader withControls />
              <ul className="divide-ink-100 divide-y">
                {products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    /*
                      The only client-side JavaScript on this page. Each control
                      subscribes to its own product's quantity, so adding one compound
                      re-renders one row.
                    */
                    controls={
                      <ProductRowControls productId={product.id} productName={product.name} />
                    }
                  />
                ))}
              </ul>
            </div>

            <p className="text-ink-600 mt-6 text-sm">
              {products.length} {products.length === 1 ? "compound" : "compounds"} available.
              Pricing is indicative — no payment is taken on this website.
            </p>
          </div>

          {/* The catalog is the complete active set, so the panel can resolve any
              saved selection without a client-side query. */}
          <OrderSummaryPanel catalog={products} className="hidden lg:block" />
        </div>
      )}

      {/* Phone-only running total. Renders nothing until the list has something on it. */}
      <StickyOrderBar catalog={products} />
    </Section>
  );
}

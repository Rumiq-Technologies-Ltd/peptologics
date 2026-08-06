import type { Metadata } from "next";
import Link from "next/link";

import { COMPLIANCE_NOTICE } from "@/constants/site";
import { MESSAGES } from "@/constants/messages";
import { ROUTES } from "@/constants/routes";
import { getContainer } from "@/services/container";
import { formatCostPerMg, formatCurrency } from "@/utils/formatCurrency";
import { formatStrengthCompact } from "@/utils/formatStrength";

/**
 * The catalog.
 *
 * A Server Component reading through the service layer — no client-side fetch, no
 * API hop to ourselves. Statically rendered and revalidated hourly, so a visitor
 * gets CDN-served HTML and a price change propagates within the hour (or
 * immediately via POST /api/revalidate).
 *
 * Presentation here is intentionally plain. The design system, the order panel
 * and the quantity controls arrive in Phase 3 and Phase 4; this phase proves the
 * data path.
 */
/**
 * One hour, inlined as a literal.
 *
 * Segment config exports must be statically analyzable — Next cannot read an
 * imported constant or an expression like `60 * 60`, and a non-literal value
 * fails the build with "Invalid segment configuration export detected". Keep this
 * in step with the other catalog routes if it changes.
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
      <main className="mx-auto w-full max-w-5xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Research Peptides</h1>
        <p className="mt-4 text-gray-600">{result.message}</p>
      </main>
    );
  }

  const products = result.data;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12">
      <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase">
        {COMPLIANCE_NOTICE}
      </p>

      <h1 className="mt-4 text-3xl font-bold tracking-tight">Research Peptides</h1>
      <p className="mt-3 max-w-2xl text-gray-600">
        List pricing shown with cost per milligram, so value is comparable across vial sizes. A
        representative confirms availability and final pricing for every inquiry.
      </p>

      {products.length === 0 ? (
        <div className="mt-10 rounded-lg border border-gray-200 p-8">
          <p className="font-medium">{MESSAGES.products.empty}</p>
          <p className="mt-1 text-sm text-gray-600">{MESSAGES.products.emptyDetail}</p>
        </div>
      ) : (
        <ul className="mt-10 divide-y divide-gray-200 border-y border-gray-200">
          {products.map((product) => (
            <li
              key={product.id}
              className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 py-4"
            >
              <div className="min-w-0">
                <Link
                  href={ROUTES.product(product.slug)}
                  className="font-semibold underline-offset-4 hover:underline"
                >
                  {product.name}
                </Link>
                <p className="font-mono text-sm text-gray-600">
                  {formatStrengthCompact(product.strengthMg)}/vial · single vial
                </p>
              </div>

              <div className="flex items-baseline gap-4 font-mono text-sm">
                <span className="text-base font-semibold">
                  {formatCurrency(product.priceCents)}
                </span>
                {/*
                  Cost per mg is suppressed for a blend: the figure divides price by
                  total milligrams across several peptides, so it is not comparable
                  to a single-peptide product and would mislead.
                */}
                <span className="w-24 text-right text-gray-600">
                  {product.isBlend ? "—" : formatCostPerMg(product.costPerMg)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-sm text-gray-500">
        {products.length} {products.length === 1 ? "compound" : "compounds"} available.
      </p>
    </main>
  );
}

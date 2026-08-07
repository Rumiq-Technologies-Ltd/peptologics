import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheckIcon } from "lucide-react";

import { Section } from "@/components/layout/Section";
import { JsonLd } from "@/components/shared/JsonLd";
import { ProductRowControls } from "@/features/cart/components/ProductRowControls";
import { COMPLIANCE_NOTICE_LONG, SITE_NAME } from "@/constants/site";
import { ROUTES } from "@/constants/routes";
import { buildBreadcrumbSchema, buildProductSchema } from "@/lib/seo/structuredData";
import { getContainer } from "@/services/container";
import { formatCostPerMg, formatCurrency } from "@/utils/formatCurrency";
import { formatStrength } from "@/utils/formatStrength";

/** One hour. Must be a literal — see the note in ../page.tsx. */
export const revalidate = 3600;

/**
 * Any slug not returned by `generateStaticParams` gets a real HTTP 404.
 *
 * This is deliberate and was chosen after measuring the alternative. With
 * `dynamicParams = true`, an unknown slug is rendered on demand — and because this
 * segment sets `revalidate`, that render is treated as prerenderable and cached, so
 * `notFound()` produces `not-found.tsx` with a **200** status. Verified against a
 * production build with a never-before-requested slug (`x-nextjs-cache: MISS`,
 * still `200 OK`). That is a soft 404: search engines index it as a real page, and
 * `robots: noindex` in `generateMetadata` mitigates the indexing but not the wrong
 * status.
 *
 * The cost of `false` is that a product added to the database after a deploy 404s
 * until the next build, because `generateStaticParams` runs at build time only —
 * ISR revalidates existing paths, it does not discover new ones. Acceptable for a
 * curated catalog of this size, and documented in docs/deployment.md.
 *
 * Price changes are unaffected: `revalidate` above still refreshes the data on
 * existing pages, and `POST /api/revalidate` forces it immediately.
 */
export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await getContainer().products.listSlugsForSitemap();
  return slugs.map(({ slug }) => ({ slug }));
}

export async function generateMetadata(props: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const result = await getContainer().products.getBySlug(slug);

  if (!result.success) {
    return { title: "Product not found", robots: { index: false, follow: true } };
  }

  const product = result.data;
  const strength = formatStrength(product.strengthMg);

  // Built from the specification rather than marketing copy, because product
  // descriptions do not exist yet and must not be invented. Every claim here is a
  // fact from the catalog row.
  const description =
    product.description ??
    `${product.name}, ${strength} per vial, supplied as lyophilized powder for laboratory research use only. List price ${formatCurrency(product.priceCents)}. Not for human or animal consumption.`;

  return {
    title: `${product.name} ${strength}`,
    description,
    alternates: { canonical: ROUTES.product(product.slug) },
    openGraph: {
      title: `${product.name} ${strength}`,
      description,
      url: ROUTES.product(product.slug),
      type: "website",
    },
  };
}

export default async function ProductPage(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  const result = await getContainer().products.getBySlug(slug);

  // NOT_FOUND is an expected outcome for an unknown slug, so it renders
  // not-found.tsx. Any other failure is thrown to the error boundary.
  if (!result.success) {
    if (result.code === "NOT_FOUND") {
      notFound();
    }

    throw new Error(result.message);
  }

  const product = result.data;

  const specifications = [
    { label: "Vial size", value: formatStrength(product.strengthMg), mono: true },
    { label: "List price", value: formatCurrency(product.priceCents), mono: true, strong: true },
    {
      label: "Cost per milligram",
      // For a blend this figure divides price by total milligrams across several
      // peptides, so it is not comparable and would mislead.
      value: product.isBlend
        ? "Not applicable — multi-peptide blend"
        : formatCostPerMg(product.costPerMg),
      mono: !product.isBlend,
    },
    { label: "Form", value: "Lyophilized powder", mono: false },
    { label: "Intended use", value: "In-vitro laboratory research only", mono: false },
  ] as const;

  return (
    <Section lattice>
      {/*
        Product without an `offers` block (ADR-012), plus a BreadcrumbList matching the
        visible trail immediately below — same labels, same order.
      */}
      <JsonLd
        schema={[
          buildProductSchema(product),
          buildBreadcrumbSchema([
            { name: "Products", path: ROUTES.products },
            { name: product.name, path: ROUTES.product(product.slug) },
          ]),
        ]}
      />

      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex items-center gap-2">
          <li>
            <Link
              href={ROUTES.products}
              className="text-ink-600 underline-offset-4 hover:underline"
            >
              Products
            </Link>
          </li>
          <li aria-hidden="true" className="text-ink-300">
            /
          </li>
          <li className="text-ink-950 font-medium" aria-current="page">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="mt-8 grid gap-12 lg:grid-cols-[7fr_5fr] lg:gap-16">
        <div>
          <h1 className="text-display text-ink-950 font-bold">{product.name}</h1>
          <p className="text-lead text-ink-600 mt-3 font-mono">
            {formatStrength(product.strengthMg)} per vial · lyophilized powder
          </p>

          <h2 className="text-h3 text-ink-950 mt-12 font-semibold">Specifications</h2>
          <dl className="divide-ink-200 border-ink-200 mt-4 divide-y border-y text-sm">
            {specifications.map((spec) => (
              <div key={spec.label} className="flex items-baseline justify-between gap-6 py-3">
                <dt className="text-ink-600">{spec.label}</dt>
                <dd
                  className={[
                    "text-right",
                    spec.mono ? "font-mono" : "",
                    "strong" in spec && spec.strong ? "text-ink-950 font-semibold" : "text-ink-800",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {spec.value}
                </dd>
              </div>
            ))}
          </dl>

          {product.description ? (
            <>
              <h2 className="text-h3 text-ink-950 mt-12 font-semibold">About this compound</h2>
              <p className="text-ink-700 mt-3 max-w-prose">{product.description}</p>
            </>
          ) : null}

          <h2 className="text-h3 text-ink-950 mt-12 font-semibold">Analytical documentation</h2>
          <p className="text-ink-700 mt-3 max-w-prose">
            A lot-specific Certificate of Analysis is available on request. A certificate applies
            only to the lot it identifies.{" "}
            <Link
              href={ROUTES.labTesting}
              className="text-brand-600 font-medium underline underline-offset-2"
            >
              How we test
            </Link>
          </p>
        </div>

        {/* Sticky inquiry panel. The add control is the page's only client leaf. */}
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="border-ink-200 shadow-panel rounded-xl border bg-white p-6">
            <p className="text-eyebrow text-ink-500 uppercase">List price</p>
            <p className="text-display text-ink-950 mt-1 font-mono font-bold">
              {formatCurrency(product.priceCents)}
            </p>
            <p className="text-ink-600 mt-1 font-mono text-sm">
              {product.isBlend
                ? "Blend — cost per mg not comparable"
                : formatCostPerMg(product.costPerMg)}
            </p>

            <ProductRowControls
              productId={product.id}
              productName={product.name}
              layout="block"
              className="mt-6"
            />

            <p className="text-ink-600 mt-4 text-xs">
              No payment is taken on this website. A representative confirms availability, lot
              documentation and final pricing.
            </p>
          </div>

          <div className="border-brand-200 bg-brand-50 mt-6 rounded-xl border p-5">
            <ShieldCheckIcon className="text-brand-800 size-5" aria-hidden="true" />
            <p className="text-ink-950 mt-2 text-sm font-semibold">Research use only</p>
            <p className="text-ink-700 mt-2 text-sm">{COMPLIANCE_NOTICE_LONG}</p>
            <p className="text-ink-700 mt-2 text-sm">
              {SITE_NAME} is not a pharmacy. We do not provide dosing information, administration
              guidance, or medical advice, and we do not supply diluents or administration
              materials.
            </p>
          </div>
        </aside>
      </div>
    </Section>
  );
}

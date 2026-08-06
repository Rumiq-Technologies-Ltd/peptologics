import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { COMPLIANCE_NOTICE_LONG } from "@/constants/site";
import { ROUTES } from "@/constants/routes";
import { getContainer } from "@/services/container";
import { formatCostPerMg, formatCurrency } from "@/utils/formatCurrency";
import { formatStrength } from "@/utils/formatStrength";

/** One hour. Must be a literal — see the note in ../page.tsx. */
export const revalidate = 3600;

/**
 * Any slug not returned by `generateStaticParams` gets a real HTTP 404.
 *
 * This is deliberate and was chosen after measuring the alternative. With
 * `dynamicParams = true`, an unknown slug is rendered on demand — and because
 * this segment sets `revalidate`, that render is treated as prerenderable and
 * cached, so `notFound()` produces `not-found.tsx` with a **200** status. Verified
 * against a production build with a never-before-requested slug
 * (`x-nextjs-cache: MISS`, still `200 OK`). That is a soft 404: search engines
 * index it as a real page, and `robots: noindex` in `generateMetadata` mitigates
 * the indexing but not the wrong status.
 *
 * The cost of `false` is that a product added to the database after a deploy 404s
 * until the next build, because `generateStaticParams` runs at build time only —
 * ISR revalidates existing paths, it does not discover new ones. Acceptable for a
 * curated catalog of this size, and documented in docs/deployment.md.
 *
 * Price changes are unaffected: `revalidate` below still refreshes the data on
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

  // Built from the specification rather than from marketing copy, because product
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

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href={ROUTES.products} className="text-gray-600 underline-offset-4 hover:underline">
          Products
        </Link>
        <span className="mx-2 text-gray-400" aria-hidden="true">
          /
        </span>
        <span className="text-gray-900">{product.name}</span>
      </nav>

      <h1 className="mt-6 text-3xl font-bold tracking-tight">{product.name}</h1>
      <p className="mt-2 font-mono text-gray-600">
        {formatStrength(product.strengthMg)} per vial · lyophilized powder
      </p>

      <h2 className="mt-10 text-lg font-semibold">Specifications</h2>
      <dl className="mt-4 divide-y divide-gray-200 border-y border-gray-200 text-sm">
        <div className="flex justify-between py-3">
          <dt className="text-gray-600">Vial size</dt>
          <dd className="font-mono">{formatStrength(product.strengthMg)}</dd>
        </div>
        <div className="flex justify-between py-3">
          <dt className="text-gray-600">List price</dt>
          <dd className="font-mono font-semibold">{formatCurrency(product.priceCents)}</dd>
        </div>
        <div className="flex justify-between py-3">
          <dt className="text-gray-600">Cost per milligram</dt>
          <dd className="font-mono">
            {product.isBlend ? (
              <span className="text-gray-500">Not applicable — multi-peptide blend</span>
            ) : (
              formatCostPerMg(product.costPerMg)
            )}
          </dd>
        </div>
        <div className="flex justify-between py-3">
          <dt className="text-gray-600">Form</dt>
          <dd>Lyophilized powder</dd>
        </div>
      </dl>

      {product.description ? (
        <>
          <h2 className="mt-10 text-lg font-semibold">About this compound</h2>
          <p className="mt-3 text-gray-700">{product.description}</p>
        </>
      ) : null}

      <div className="mt-10 rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700">
        <p className="font-semibold">Research use only</p>
        <p className="mt-1">{COMPLIANCE_NOTICE_LONG}</p>
        <p className="mt-2">
          PeptoLogics is not a pharmacy. We do not provide dosing information, administration
          guidance, or medical advice, and we do not supply diluents or administration materials.
        </p>
      </div>

      <p className="mt-8 text-sm text-gray-600">
        Pricing shown is indicative list pricing. No payment is taken on this website — a
        representative confirms availability, lot documentation and final pricing for every inquiry.
      </p>
    </main>
  );
}

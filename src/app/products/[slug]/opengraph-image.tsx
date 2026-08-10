import { ImageResponse } from "next/og";

import { COMPLIANCE_NOTICE, SITE_NAME } from "@/constants/site";
import { getContainer } from "@/services/container";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatStrength } from "@/utils/formatStrength";

/**
 * Per-product social preview.
 *
 * Generated at build time for all twelve products, because the segment sets
 * `dynamicParams = false`. A shared card would show the brand for every compound; this
 * shows the compound, its vial size and its list price, which is what makes a shared
 * link useful.
 *
 * If the product cannot be read — a build-time Supabase blip — the card falls back to
 * the brand rather than throwing, because an image route that throws fails the build.
 */

export const alt = "Research peptide specification";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Restated here rather than inherited from the page.
 *
 * Segment config and `generateStaticParams` are per-file, so without this the image
 * route stayed dynamic — verified in the build output — and every social scrape would
 * have cost a Supabase read and an image render. With it, all twelve are generated at
 * build time and served from the CDN.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await getContainer().products.listSlugsForSitemap();
  return slugs.map(({ slug }) => ({ slug }));
}

export default async function ProductOpengraphImage({
  // A Promise in Next 16, like `params` everywhere else in the App Router.
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getContainer().products.getBySlug(slug);
  const product = result.success ? result.data : null;

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#ffffff",
        padding: 72,
        color: "#222223",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            width: 180,
            height: 6,
            backgroundImage: "linear-gradient(90deg, #033291 0%, #1d4ed8 60%, #92aef4 100%)",
          }}
        />

        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 24,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#033291",
          }}
        >
          {SITE_NAME}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontSize: 84,
            fontWeight: 700,
            letterSpacing: -2,
          }}
        >
          {product ? product.name : "Research peptides"}
        </div>

        {product ? (
          <div style={{ display: "flex", marginTop: 24, fontSize: 34, color: "#58585d" }}>
            {formatStrength(product.strengthMg, product.strengthUnit)} per vial ·{" "}
            {product.strengthUnit === "ml" ? "sterile solution" : "lyophilized powder"}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {product ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
            <div style={{ display: "flex", fontSize: 64, fontWeight: 700 }}>
              {formatCurrency(product.priceCents)}
            </div>
            <div style={{ display: "flex", fontSize: 26, color: "#58585d" }}>
              indicative list price
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            marginTop: 24,
            paddingTop: 24,
            borderTop: "2px solid #e2e2e4",
            fontSize: 22,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "#75757a",
          }}
        >
          {COMPLIANCE_NOTICE}
        </div>
      </div>
    </div>,
    size,
  );
}

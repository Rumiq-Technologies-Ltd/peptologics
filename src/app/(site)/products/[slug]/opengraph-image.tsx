import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";

import { COMPLIANCE_NOTICE, SITE_NAME } from "@/constants/site";
import { getContainer } from "@/services/container";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatStrength } from "@/utils/formatStrength";

/**
 * Per-product social preview.
 *
 * A shared card would show the brand for every compound; this shows the compound, its vial
 * size and its list price, which is what makes a shared link useful.
 *
 * Rendered on every request, like the product page (ADR-039): a product created in the admin
 * has a card straight away, with no build, and an edit shows in the next scrape. An unknown or
 * archived product is a real 404, not a brand card served with status 200. If the catalog
 * cannot be read the card falls back to the brand: a social scraper then gets an image, not an
 * error, and nothing caches it.
 */

export const alt = "Research peptide specification";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export const dynamic = "force-dynamic";

export default async function ProductOpengraphImage({
  // A Promise in Next 16, like `params` everywhere else in the App Router.
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getContainer().products.getBySlug(slug);
  if (!result.success && result.code === "NOT_FOUND") notFound();
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

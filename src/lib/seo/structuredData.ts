import { COMPLIANCE_NOTICE_LONG, SITE_DESCRIPTION, SITE_NAME } from "@/constants/site";
import { ROUTES } from "@/constants/routes";
import type { Product } from "@/features/products/types/product";
import { siteUrl } from "@/lib/env.client";
import { formatStrength } from "@/utils/formatStrength";

/**
 * Schema.org builders.
 *
 * Every graph here describes something the visitor can actually see on the page that
 * emits it. That is a requirement, not politeness: Google's structured-data policy
 * treats markup describing absent content as spam, and the penalty lands on the whole
 * site rather than the page.
 *
 * Plain objects, not JSX. Serialisation and the `<script>` tag live in `JsonLd`, so a
 * builder can be unit-tested without a renderer.
 */

/** A JSON-LD node. Loose by necessity — the vocabulary is open-ended. */
export type JsonLdNode = Record<string, unknown>;

/** Absolute URL for a site-relative path. Structured data must not use relative URLs. */
function absolute(path: string): string {
  return new URL(path, siteUrl).toString();
}

/**
 * The organisation behind the site.
 *
 * `@id` is stable and reused by every other node that references the publisher, so the
 * graph describes one organisation rather than a new one per page.
 */
export function buildOrganizationSchema(): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absolute("/#organization"),
    name: SITE_NAME,
    url: siteUrl,
    logo: absolute("/brand/peptologics-badge.svg"),
    description: SITE_DESCRIPTION,
    // Research-use-only is a material fact about what this company supplies, so it
    // belongs in the machine-readable description too.
    disambiguatingDescription: COMPLIANCE_NOTICE_LONG,
  };
}

/** The website itself. No `SearchAction` — there is no search endpoint to point at. */
export function buildWebSiteSchema(): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absolute("/#website"),
    name: SITE_NAME,
    url: siteUrl,
    description: SITE_DESCRIPTION,
    publisher: { "@id": absolute("/#organization") },
    inLanguage: "en-US",
  };
}

/**
 * A product, **without an `offers` block** (ADR-012).
 *
 * `offers` asserts that the item can be bought at a stated price. Nothing here can be
 * bought: the site takes no payment, the price is indicative, and a representative
 * confirms the real total. Publishing `offers` would put a "buy now" price into search
 * results for a research reagent — commercially misleading and, for this product
 * category, a compliance risk.
 *
 * The price still appears on the page for humans. It simply is not claimed as a
 * purchasable offer.
 */
export function buildProductSchema(product: Product): JsonLdNode {
  const strength = formatStrength(product.strengthMg, product.strengthUnit);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": absolute(`${ROUTES.product(product.slug)}#product`),
    name: `${product.name} ${strength}`,
    url: absolute(ROUTES.product(product.slug)),
    sku: product.slug,
    category: "Research reagent",
    description:
      product.description ??
      `${product.name}, ${strength} per vial, supplied as lyophilized powder for laboratory research use only. Not for human or animal consumption.`,
    brand: { "@type": "Brand", name: SITE_NAME },
    manufacturer: { "@id": absolute("/#organization") },
    ...(product.imageUrl ? { image: product.imageUrl } : {}),
    additionalProperty: [
      { "@type": "PropertyValue", name: "Vial size", value: strength },
      { "@type": "PropertyValue", name: "Form", value: "Lyophilized powder" },
      {
        "@type": "PropertyValue",
        name: "Intended use",
        value: "In-vitro laboratory research only",
      },
    ],
  };
}

export interface BreadcrumbEntry {
  name: string;
  /** Site-relative path. Converted to absolute here. */
  path: string;
}

/** Breadcrumbs. Must match the visible trail on the page, in the same order. */
export function buildBreadcrumbSchema(entries: readonly BreadcrumbEntry[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: absolute(entry.path),
    })),
  };
}

export interface FaqEntry {
  question: string;
  answer: string;
}

/**
 * FAQ markup.
 *
 * Built from the same array the page renders, so the two cannot drift — the failure
 * mode Google penalises is markup that answers a question the page does not.
 */
export function buildFaqSchema(entries: readonly FaqEntry[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}

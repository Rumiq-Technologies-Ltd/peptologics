/**
 * Every internal path in one place. Avoids magic strings in links, the sitemap,
 * the gate's exemption list, and structured data.
 */

export const ROUTES = {
  home: "/",
  products: "/products",
  product: (slug: string) => `/products/${slug}`,
  cart: "/cart",
  inquiry: "/inquiry",
  inquirySuccess: "/inquiry/success",
  labTesting: "/lab-testing",
  about: "/about",
  contact: "/contact",
  terms: "/terms",
  privacy: "/privacy",
  researchUseOnly: "/research-use-only",
  shipping: "/shipping",
  notEligible: "/not-eligible",
} as const;

/** Public routes that belong in the XML sitemap, most important first. */
export const SITEMAP_STATIC_ROUTES: readonly string[] = [
  ROUTES.home,
  ROUTES.products,
  ROUTES.labTesting,
  ROUTES.about,
  ROUTES.contact,
  ROUTES.shipping,
  ROUTES.researchUseOnly,
  ROUTES.terms,
  ROUTES.privacy,
];

/**
 * Routes the disclaimer gate must never cover.
 *
 * The gate links to the policy pages; if those pages were themselves gated, the
 * new tab would show a second gate and the visitor could never read the terms
 * they are being asked to accept.
 */
export const GATE_EXEMPT_ROUTES: readonly string[] = [
  ROUTES.terms,
  ROUTES.privacy,
  ROUTES.researchUseOnly,
  ROUTES.notEligible,
];

/** Primary navigation, in display order. */
export const PRIMARY_NAV: readonly { href: string; label: string }[] = [
  { href: ROUTES.products, label: "Products" },
  { href: ROUTES.labTesting, label: "Lab Testing" },
  { href: ROUTES.about, label: "About" },
  { href: ROUTES.contact, label: "Contact" },
];

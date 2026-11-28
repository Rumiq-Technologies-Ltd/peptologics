import type { NextConfig } from "next";

/**
 * Next configuration.
 *
 * Security headers live here rather than in a host-specific config file, so they apply to
 * `next start` and to any host, including Amplify — and so a change to them
 * goes through code review like everything else.
 */

/**
 * Content Security Policy.
 *
 * `script-src` includes `'unsafe-inline'`, and that is a deliberate trade rather than an
 * oversight. Removing it needs a per-request nonce, which means:
 *
 * - the nonce must be generated per request, which makes every page **dynamic** and
 *   throws away the static prerendering and CDN delivery the whole site is built on;
 * - the disclaimer gate's pre-paint script must execute before hydration and before the
 *   browser composites anything (ADR-009), so it cannot wait for React to attach a nonce;
 * - Next injects its own inline bootstrap scripts, which would each need the same nonce.
 *
 * A hash-based policy was also rejected: the JSON-LD blocks differ per page, so the hash
 * set would have to be computed at build time per route and kept in step by hand.
 *
 * What the policy still buys, and what `'unsafe-inline'` does not weaken:
 *
 * - `default-src 'self'` — no third-party origin can load anything.
 * - `object-src 'none'` — no Flash/PDF plugin embedding, a classic XSS vector.
 * - `base-uri 'self'` — an injected `<base>` tag cannot repoint every relative URL.
 * - `form-action 'self'` — an injected form cannot post the customer's details elsewhere.
 * - `frame-ancestors 'none'` — the site cannot be framed, so clickjacking the gate or the
 *   inquiry form is impossible.
 * - `upgrade-insecure-requests` — any stray http:// subresource is fetched over https.
 *
 * Revisit if the site ever gains a genuinely dynamic surface (authentication, an admin
 * dashboard); at that point a nonce costs nothing that is not already dynamic.
 */
/**
 * React's development build uses `eval()` for debugging features — reconstructing
 * callstacks across environments, the error overlay. With a CSP and no `'unsafe-eval'`
 * it logs an error on every page load and those features stop working.
 *
 * Allowed in development only. The production policy is unchanged, and React never uses
 * `eval()` in a production build.
 */
const DEV_SCRIPT_SRC = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";

/** ` https://<bucket>.s3.us-east-1.amazonaws.com` when a media bucket is configured, else empty. */
function mediaBucketOrigin(): string {
  const bucket = process.env.NEXT_PUBLIC_MEDIA_BUCKET_NAME;
  return bucket ? ` https://${bucket}.s3.us-east-1.amazonaws.com` : "";
}

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // Inline: Next's bootstrap and the gate's pre-paint script. See the note above.
  `script-src 'self' 'unsafe-inline'${DEV_SCRIPT_SRC}`,
  // Tailwind emits a stylesheet, but Next inlines critical CSS and injects style tags.
  "style-src 'self' 'unsafe-inline'",
  // data: for the generated OG/icon images; https: so client-supplied product
  // photography in Supabase Storage works without another deploy.
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  // The browser talks to our own origin only, plus (admin product images) a direct PUT to the
  // private media bucket, which accepts nothing without a presigned signature.
  `connect-src 'self'${mediaBucketOrigin()}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  {
    /*
     * Two years, subdomains included, and preload-eligible. Only ever sent over https,
     * so it is inert during local development.
     */
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Stops a browser MIME-sniffing a response into something executable.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Belt and braces with frame-ancestors, for anything that predates CSP support.
  { key: "X-Frame-Options", value: "DENY" },
  // Send the origin cross-site, the full path same-site. No query strings leak outward.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The site asks for none of these. Denying them explicitly means a future dependency
  // cannot quietly start asking.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Isolates the browsing context from cross-origin popups it did not open.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const ADMIN_HEADERS = [
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
];

/**
 * The Supabase Storage host, derived from the project URL rather than hardcoded.
 *
 * `products.image_url` is empty today — the catalog is intentionally image-free, since
 * stock vial photography on a research reagent implies human use. When the client does
 * supply product photography it will live in Supabase Storage, and `next/image` refuses
 * any remote host not listed here. Deriving the pattern means a project change cannot
 * silently break image optimisation.
 */
function supabaseImagePattern() {
  const url = process.env.SUPABASE_URL;
  if (!url) return [];

  try {
    return [
      {
        protocol: "https" as const,
        hostname: new URL(url).hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ];
  } catch {
    // A malformed URL is caught properly by the Zod env schema at runtime. Failing the
    // build here would give a far worse error message for the same mistake.
    return [];
  }
}

/**
 * The media CDN host for product images uploaded through the admin, derived from the public
 * base URL like the Supabase pattern above. Only `/products/*` is ever served from it.
 */
function mediaImagePattern() {
  const base = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
  if (!base) return [];

  try {
    return [
      {
        protocol: "https" as const,
        hostname: new URL(base).hostname,
        pathname: "/products/**",
      },
    ];
  } catch {
    // The Zod env schema reports a malformed URL properly at runtime.
    return [];
  }
}

const nextConfig: NextConfig = {
  /**
   * Keeps `sharp` out of the server bundle.
   *
   * `sharp` is a native addon whose libvips build loads its format handlers as separate
   * platform libraries. Bundled by Turbopack, the raster pipeline still works — PNG in,
   * PNG out — but the SVG loader is no longer found, so any `sharp(svgBuffer)` call fails
   * with "Input buffer contains unsupported image format".
   *
   * That is exactly the call `next/og` makes: `ImageResponse` renders to SVG with satori,
   * then rasterizes with `sharp` when it can import it. So every generated image route —
   * `icon.tsx`, `apple-icon.tsx`, `opengraph-image.tsx` — returned a 500 and the dev
   * server logged "failed to pipe response".
   *
   * Marking the package external leaves it to Node's own resolver, which loads the addon
   * from `node_modules` with its libraries intact.
   */
  serverExternalPackages: ["sharp"],

  images: {
    remotePatterns: [...supabaseImagePattern(), ...mediaImagePattern()],
    // AVIF first, WebP as the fallback: both are widely supported and materially
    // smaller than the JPEG or PNG a supplier will send us.
    formats: ["image/avif", "image/webp"],
  },

  /**
   * Renders `app/global-not-found.tsx` for URLs that match no route. Needed because the site
   * and the admin are separate root layouts (ADR-038), so there is no shared layout to hold a
   * plain `not-found.tsx`.
   */
  experimental: { globalNotFound: true },

  // Emits no `X-Powered-By: Next.js`. Free, and there is no reason to advertise the
  // framework and its version to anyone scanning.
  poweredByHeader: false,

  async headers() {
    return [
      {
        // Every route, including the API and the generated images.
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      {
        // The admin and its sign-in routes: never indexed, never cached by a browser or a CDN
        // (ADR-038). The nonce-based CSP for `/admin` is set per request in `src/proxy.ts`.
        source: "/admin/:path*",
        headers: ADMIN_HEADERS,
      },
      { source: "/api/auth/:path*", headers: ADMIN_HEADERS },
    ];
  },

  /**
   * Product URLs that changed when a vial size changed.
   *
   * `/products/[slug]` sets `dynamicParams = false`, so a slug that is no longer in the
   * catalog returns a hard 404 — which is right for a product that never existed and
   * wrong for one that simply moved. A permanent redirect passes the link equity on and
   * keeps any bookmark or shared link working.
   *
   * Add a pair here whenever a size change renames a slug. **Before adding a product,
   * check that its slug is not the `source` of a rule here** — a redirect outranks the
   * route, so a live product behind one is unreachable: its page is prerendered, its
   * sitemap entry is advertised, and every request for it 308s somewhere else. That
   * happened to `tesamorelin-10mg` between 16 and 18 Aug 2026, and the only symptom was a
   * page nobody could open.
   *
   * A rule is removed only when its `source` is a live product again, which is the one
   * case where redirecting is the wrong answer. Otherwise leave them alone: a stale
   * redirect costs nothing, and deleting one breaks links that are already in the wild.
   */
  /**
   * Share-image URLs keep their old addresses.
   *
   * Moving the public routes into the `(site)` group (ADR-038) makes Next add a hash of the
   * route's folder to the name of every metadata image inside it, so the site share image is
   * now served at `/opengraph-image-<hash>` and the product one at
   * `/products/<slug>/opengraph-image-<hash>`, and each page's `og:image` tag points there.
   * Links shared or cached before the move still name the unhashed addresses; these keep
   * them working. The hashes come from the folders `/(site)` and `/(site)/products/[slug]`,
   * so they change only if those folders move (the build output lists the current ones).
   */
  async rewrites() {
    return [
      { source: "/opengraph-image", destination: "/opengraph-image-12o0cb" },
      {
        source: "/products/:slug/opengraph-image",
        destination: "/products/:slug/opengraph-image-17ynyi",
      },
    ];
  },

  async redirects() {
    return [
      /*
       * Tesamorelin's 10 mg redirect was removed on 18 Aug 2026, when the 10 mg vial
       * returned to the catalog alongside the 5 mg. The compound has since been sold as
       * 10 mg, 5 mg, 20 mg and 10 mg again, and from 24 Nov 2026 as 20 mg only — which is
       * also why its only Certificate of Analysis names 10 mg.
       */
      // Glutathione moved from 10 mg to 1500 mg, then to 600 mg on 1 Oct 2026.
      {
        source: "/products/glutathione-10mg",
        destination: "/products/glutathione-600mg",
        permanent: true,
      },
      {
        source: "/products/glutathione-1500mg",
        destination: "/products/glutathione-600mg",
        permanent: true,
      },
      /*
       * 27 Aug 2026. CJC/IPA was listed at 30 mg until the vial renders arrived reading
       * 10 MG; the strength was corrected, so the slug moved with it.
       */
      {
        source: "/products/cjc-ipa-30mg",
        destination: "/products/cjc-ipa-10mg",
        permanent: true,
      },
      /*
       * 27 Aug 2026. Tesamorelin dropped its smaller vial, so the retired size points at
       * the one still sold rather than 404ing on a link someone already has. Retargeted to
       * the 20 mg vial on 24 Nov 2026, when it replaced the 10 mg.
       *
       * PL3 10 mg had the same redirect until 21 Sep 2026, when the vial returned to
       * the catalog. A permanent redirect off its own slug would now hide the product.
       */
      {
        source: "/products/tesamorelin-5mg",
        destination: "/products/tesamorelin-20mg",
        permanent: true,
      },
      /*
       * 24 Nov 2026. The 20 mg vial replaced the 10 mg, so the retired slug points at it.
       * (Until 24 Nov this pair ran the other way, from 20 mg to 10 mg, after the 20 mg
       * was withdrawn on 27 Sep 2026; that rule was removed because 20 mg is live again.)
       */
      {
        source: "/products/tesamorelin-10mg",
        destination: "/products/tesamorelin-20mg",
        permanent: true,
      },
      /*
       * 28 Aug 2026. The official price menu lists GHK-Cu at 100 mg, not the 50 mg the
       * catalog had carried; repriced against that menu and the slug moved with it.
       */
      {
        source: "/products/ghk-cu-50mg",
        destination: "/products/ghk-cu-100mg",
        permanent: true,
      },
      /*
       * 27 Nov 2026. PL3, PL2 and Elora moved to new slugs (the compound names came off the
       * site; Elora's slug now matches its name). The old slugs are the only place the old
       * names remain, by owner decision, so a link someone already has still lands.
       */
      { source: "/products/retatrutide-10mg", destination: "/products/pl3-10mg", permanent: true },
      { source: "/products/retatrutide-30mg", destination: "/products/pl3-30mg", permanent: true },
      { source: "/products/tirzepatide-10mg", destination: "/products/pl2-10mg", permanent: true },
      { source: "/products/tirzepatide-30mg", destination: "/products/pl2-30mg", permanent: true },
      { source: "/products/eloralintide-5mg", destination: "/products/elora-5mg", permanent: true },
      /*
       * K-L-O-W deliberately has no redirect. It is discontinued with no equivalent vial,
       * and pointing it at an unrelated compound would answer a request for one product
       * with another. A 404 is the honest response.
       */
    ];
  },
};

export default nextConfig;

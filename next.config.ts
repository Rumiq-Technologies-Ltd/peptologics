import type { NextConfig } from "next";

/**
 * Next configuration.
 *
 * Security headers live here rather than in `vercel.json`, so they apply to
 * `next start` and to any future host as well as to Vercel — and so a change to them
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
  // The browser talks to our own origin only. Supabase is server-side exclusively.
  "connect-src 'self'",
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
    remotePatterns: supabaseImagePattern(),
    // AVIF first, WebP as the fallback: both are widely supported and materially
    // smaller than the JPEG or PNG a supplier will send us.
    formats: ["image/avif", "image/webp"],
  },

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
  async redirects() {
    return [
      /*
       * Tesamorelin's 10 mg redirect was removed on 18 Aug 2026, when the 10 mg vial
       * returned to the catalog alongside the 5 mg. The compound has now been sold as
       * 10 mg, then 5 mg, and now both — which is also why its only Certificate of
       * Analysis names 10 mg.
       */
      // Glutathione moved from a 10 mg vial to 1500 mg, 8 Aug 2026.
      {
        source: "/products/glutathione-10mg",
        destination: "/products/glutathione-1500mg",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

/**
 * Next configuration.
 *
 * Deliberately small. Security headers land in Phase 9 alongside the Vercel setup,
 * where they can be verified against a real deployment rather than guessed at.
 */

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
  images: {
    remotePatterns: supabaseImagePattern(),
    // AVIF first, WebP as the fallback: both are widely supported and materially
    // smaller than the JPEG or PNG a supplier will send us.
    formats: ["image/avif", "image/webp"],
  },

  // Emits no `X-Powered-By: Next.js`. Free, and there is no reason to advertise the
  // framework and its version to anyone scanning.
  poweredByHeader: false,
};

export default nextConfig;

import type { Metadata } from "next";

import { SiteDocument } from "@/components/layout/SiteDocument";
import { SITE_NAME, SITE_TAGLINE } from "@/constants/site";
import { env } from "@/lib/env";
import { siteMetadata } from "@/lib/seo/siteMetadata";

import NotFound from "./(site)/not-found";

import "./globals.css";

/**
 * The 404 for a URL that matches no route.
 *
 * The public site and the admin each have their own root layout (ADR-038), so Next has no
 * single layout to wrap an unmatched URL in and renders this instead. It is the public site's
 * document around the public site's 404 content, which is what an unmatched URL showed before
 * the split.
 */
/*
 * Every other public page gets its share image from `opengraph-image.tsx`, which Next attaches
 * to the pages beneath it. This page is outside that tree, so it names the same image by its
 * public address (which rewrites to the file, see `next.config.ts`).
 */
const SHARE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
  type: "image/png",
};

export const metadata: Metadata = {
  ...siteMetadata,
  openGraph: { ...siteMetadata.openGraph, images: [SHARE_IMAGE] },
  twitter: { ...siteMetadata.twitter, images: [SHARE_IMAGE] },
};

export default function GlobalNotFound() {
  return (
    <SiteDocument appEnv={env.APP_ENV}>
      <NotFound />
    </SiteDocument>
  );
}

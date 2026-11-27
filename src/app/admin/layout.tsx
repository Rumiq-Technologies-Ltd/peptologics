import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { displaySans, plexMono } from "@/components/layout/fonts";
import { adminEnabled } from "@/lib/env";

import "../globals.css";

/**
 * The admin's own root layout (ADR-038).
 *
 * Separate from the public site's so none of the public chrome, the disclaimer gate, the cart
 * or the marketing scripts load here, and so `/admin` can be dynamic on every request without
 * making the public pages dynamic too.
 *
 * Every admin page is dynamic: it reads the session cookie, which opts the route out of
 * prerendering and caching. `force-dynamic` states that intent rather than leaving it implied.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | PeptoLogics admin" },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  // Disabled means the admin does not exist: a 404 from the layout, before any page runs (the same page an unknown URL gets).
  if (!adminEnabled) notFound();

  return (
    <html lang="en" className={`${displaySans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <a
          href="#admin-main"
          className="focus:bg-brand-800 sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:px-3 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}

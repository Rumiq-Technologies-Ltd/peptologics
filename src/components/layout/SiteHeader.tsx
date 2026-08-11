import Link from "next/link";

import { Container } from "@/components/layout/Container";
import { HeaderNav } from "@/components/layout/HeaderNav";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { CartBadge } from "@/features/cart/components/CartBadge";
import { ROUTES } from "@/constants/routes";
import { SITE_NAME } from "@/constants/site";

/**
 * Site header. A Server Component — only the nav's active-state logic and the
 * mobile drawer are client-side.
 *
 * Not sticky. A sticky header plus the permanent compliance strip would consume
 * 96px of a phone viewport on a page whose job is reading a data table. The
 * catalog is the primary surface and it needs the height.
 */
export function SiteHeader() {
  return (
    <header className="border-ink-200 border-b bg-white">
      <Container>
        <div className="h-header flex items-center justify-between gap-4">
          <Link
            href={ROUTES.home}
            aria-label={`${SITE_NAME} home`}
            className="inline-flex items-center rounded-md"
          >
            {/*
              The client's mark with the wordmark beside it. The one logo above the
              fold, so it preloads.
            */}
            <BrandLogo variant="mark" size={50} preload />
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <HeaderNav />

            {/* On every breakpoint: the list is the one piece of state a visitor
                accumulates, so it needs a permanent way back to it. */}
            <CartBadge />

            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href={ROUTES.products}>Request a quote</Link>
            </Button>

            <MobileNav />
          </div>
        </div>
      </Container>

      {/* The gradient rule echoing the logo's blue-to-charcoal ring. */}
      <div className="brand-rule h-0.5" aria-hidden="true" />
    </header>
  );
}

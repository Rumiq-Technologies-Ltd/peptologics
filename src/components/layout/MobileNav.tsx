"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { PRIMARY_NAV, ROUTES } from "@/constants/routes";
import { cn } from "@/utils/cn";

/**
 * Mobile navigation drawer.
 *
 * Uses Radix's Sheet, which is correct here: Escape *should* close a navigation
 * drawer, focus should return to the trigger, and the page behind should be inert.
 * All of that is standard dialog behaviour and Radix does it well.
 *
 * The disclaimer gate deliberately does NOT use this — a compliance gate must not
 * be dismissible, and suppressing Radix's Escape handling reliably is harder than
 * not having one. See DisclaimerGate for that reasoning.
 */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild className="lg:hidden">
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <MenuIcon className="size-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-[300px] sm:w-[360px]">
        <SheetHeader className="border-ink-200 border-b">
          <SheetTitle className="text-left">
            <BrandLogo size={32} />
          </SheetTitle>
        </SheetHeader>

        <nav aria-label="Primary" className="px-4 py-2">
          <ul className="flex flex-col">
            {PRIMARY_NAV.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    // Closing on click is explicit rather than relying on route
                    // change, so the drawer never lingers over the new page.
                    onClick={() => setOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      // 44px minimum touch target.
                      "border-ink-100 flex min-h-11 items-center border-b text-base font-medium",
                      isActive ? "text-brand-800" : "text-ink-800",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-ink-200 mt-auto flex flex-col gap-3 border-t p-4">
          <Button asChild className="w-full">
            <Link href={ROUTES.products} onClick={() => setOpen(false)}>
              Browse products
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={ROUTES.contact} onClick={() => setOpen(false)}>
              Contact us
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PRIMARY_NAV } from "@/constants/routes";
import { cn } from "@/utils/cn";

/**
 * Desktop primary navigation.
 *
 * A Client Component for one reason: `usePathname`, which a layout cannot read
 * server-side. Keeping it as a leaf means the header and layout stay Server
 * Components — only the link list ships JavaScript.
 *
 * The active page is marked with `aria-current="page"` as well as visually, so it
 * is announced rather than only seen.
 */
export function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {PRIMARY_NAV.map((item) => {
          // Exact match, or a section match so /products/retatrutide-10mg still
          // highlights "Products".
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors",
                  isActive ? "text-brand-800" : "text-ink-700 hover:bg-ink-50 hover:text-ink-950",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { roleSatisfies, type AdminRole } from "@/lib/admin/roles";
import { cn } from "@/utils/cn";

import { ADMIN_NAV } from "../constants/adminNav";

interface AdminNavProps {
  role: AdminRole;
  /** Called after a link is chosen, so the mobile drawer can close. */
  onNavigate?: () => void;
}

/** The sidebar links for a role. Hiding is a courtesy; the server enforces the role. */
export function AdminNav({ role, onNavigate }: AdminNavProps) {
  const pathname = usePathname();
  const items = ADMIN_NAV.filter((item) => roleSatisfies(role, item.minRole));

  return (
    <nav aria-label="Admin">
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);

          const content = (
            <>
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span>{item.label}</span>
              {!item.available && (
                <span className="text-ink-500 ml-auto text-xs font-normal whitespace-nowrap">
                  Coming soon
                </span>
              )}
            </>
          );

          return (
            <li key={item.href}>
              {item.available ? (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium",
                    isActive
                      ? "bg-brand-50 text-brand-800"
                      : "text-ink-800 hover:bg-ink-100 hover:text-ink-950",
                  )}
                >
                  {content}
                </Link>
              ) : (
                // Not a link: a disabled item is not focusable and says why to a screen reader.
                <span
                  aria-disabled="true"
                  className="text-ink-500 flex min-h-11 cursor-not-allowed items-center gap-3 px-3 text-sm font-medium"
                >
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

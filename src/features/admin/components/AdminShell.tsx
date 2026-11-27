"use client";

import { useState, type ReactNode } from "react";
import { MenuIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ADMIN_PATHS } from "@/lib/admin/paths";
import type { AdminRole } from "@/lib/admin/roles";

import { AdminNav } from "./AdminNav";

interface AdminShellProps {
  email: string;
  role: AdminRole;
  children: ReactNode;
}

const ROLE_LABEL: Record<AdminRole, string> = { owner: "Owner", editor: "Editor" };

/**
 * The admin frame: a left sidebar from `lg`, a drawer below it, and a top bar with who is
 * signed in. The only client state is whether the drawer is open.
 */
export function AdminShell({ email, role, children }: AdminShellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-ink-50 flex min-h-screen">
      <aside className="border-ink-200 hidden w-64 shrink-0 border-r bg-white p-4 lg:block">
        <p className="text-ink-950 px-3 pb-4 text-base font-bold">PeptoLogics admin</p>
        <AdminNav role={role} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-ink-200 flex min-h-14 items-center gap-3 border-b bg-white px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" aria-label="Open menu" className="size-11">
                <MenuIcon className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px]">
              <SheetHeader className="border-ink-200 border-b">
                <SheetTitle className="text-left">PeptoLogics admin</SheetTitle>
                <SheetDescription className="sr-only">Admin navigation</SheetDescription>
              </SheetHeader>
              <div className="p-4">
                <AdminNav role={role} onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="ml-auto flex min-w-0 items-center gap-3 text-sm">
            <span className="text-ink-700 min-w-0 truncate" title={email}>
              {email}
            </span>
            <span className="bg-ink-100 text-ink-800 rounded-full px-2 py-0.5 text-xs font-medium">
              {ROLE_LABEL[role]}
            </span>
            {/* A plain link, not next/link: sign-out is a full navigation through Cognito. */}
            <Button asChild variant="ghost" size="sm">
              <a href={ADMIN_PATHS.signOut}>Sign out</a>
            </Button>
          </div>
        </header>

        <main id="admin-main" className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

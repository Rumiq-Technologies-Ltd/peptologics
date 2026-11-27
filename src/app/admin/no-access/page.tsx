import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ADMIN_PATHS } from "@/lib/admin/paths";
import { getAdminSession } from "@/lib/admin/session.server";

export const metadata: Metadata = { title: "No access" };

/**
 * Where a signed-in person in neither group lands. It needs a verified session but no role, so
 * it does not call `requireAdmin`. Someone who does have a role is sent on to the admin.
 */
export default async function NoAccessPage() {
  const session = await getAdminSession();

  if (!session) redirect(ADMIN_PATHS.signIn);
  if (session.role) redirect(ADMIN_PATHS.home);

  return (
    <main id="admin-main" className="mx-auto max-w-xl p-8">
      <h1 className="text-ink-950 text-2xl font-bold">No access</h1>
      <p className="text-ink-700 mt-3">
        {session.email} is signed in, but this account has not been given a role. Ask the site owner
        to add you, then sign in again.
      </p>
      <Button asChild className="mt-6">
        <a href={ADMIN_PATHS.signOut}>Sign out</a>
      </Button>
    </main>
  );
}

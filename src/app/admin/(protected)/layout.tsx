import { AdminShell } from "@/features/admin/components/AdminShell";
import { requireAdmin } from "@/lib/admin/authorize.server";

/**
 * Frames every signed-in admin page. It checks access so the shell never renders for the wrong
 * person, but a layout does not stop its pages from rendering: each page calls `requireAdmin`
 * itself with the role it needs.
 */
export default async function ProtectedAdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await requireAdmin({ role: "editor" });

  return (
    <AdminShell email={session.email} role={session.role}>
      {children}
    </AdminShell>
  );
}

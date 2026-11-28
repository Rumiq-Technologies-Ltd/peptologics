import {
  FlaskConicalIcon,
  FileTextIcon,
  HomeIcon,
  PackageIcon,
  SettingsIcon,
  ShoppingBagIcon,
  TagIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import { ADMIN_PATHS } from "@/lib/admin/paths";
import type { AdminRole } from "@/lib/admin/roles";

/**
 * The admin sidebar, in display order (D35). Items whose phase is not built show as
 * "Coming soon" and are disabled; each phase flips its own item to `available`.
 * `minRole` only hides an item: the server still checks the role on every page.
 */
export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  available: boolean;
  minRole: AdminRole;
}

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { label: "Home", href: ADMIN_PATHS.home, icon: HomeIcon, available: true, minRole: "editor" },
  {
    label: "Products",
    href: "/admin/products",
    icon: PackageIcon,
    available: true,
    minRole: "editor",
  },
  {
    label: "Orders",
    href: "/admin/orders",
    icon: ShoppingBagIcon,
    available: true,
    minRole: "editor",
  },
  {
    label: "Lab reports",
    href: "/admin/lab-reports",
    icon: FlaskConicalIcon,
    available: false,
    minRole: "editor",
  },
  {
    label: "Content",
    href: "/admin/content",
    icon: FileTextIcon,
    available: false,
    minRole: "editor",
  },
  {
    label: "Discounts",
    href: "/admin/discounts",
    icon: TagIcon,
    available: false,
    minRole: "editor",
  },
  {
    label: "Customers",
    href: "/admin/customers",
    icon: UsersIcon,
    available: false,
    minRole: "editor",
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: SettingsIcon,
    available: false,
    minRole: "owner",
  },
];

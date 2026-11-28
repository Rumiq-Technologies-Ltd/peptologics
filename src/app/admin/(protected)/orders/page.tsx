import type { Metadata } from "next";

import { OrdersTable } from "@/features/admin/orders/components/OrdersTable";
import { getOrderAdmin } from "@/features/admin/orders/services/container.server";
import { MAX_MONTHS } from "@/features/admin/orders/utils/orderMonths";
import { parseStatusFilter } from "@/features/admin/orders/utils/orderList";
import { requireAdmin } from "@/lib/admin/authorize.server";

export const metadata: Metadata = { title: "Orders" };

/** `?months=` from the address bar, kept between 1 and the limit. */
function parseMonths(value: string | string[] | undefined): number {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(parsed) && parsed >= 1 ? Math.min(parsed, MAX_MONTHS) : 1;
}

export default async function AdminOrdersPage(props: PageProps<"/admin/orders">) {
  await requireAdmin({ role: "editor" });

  const query = await props.searchParams;
  const months = parseMonths(query.months);
  const status = parseStatusFilter(Array.isArray(query.status) ? query.status[0] : query.status);
  const orders = await getOrderAdmin().listRecent(months);

  return (
    <div className="mx-auto max-w-6xl">
      <OrdersTable
        orders={orders}
        months={months}
        canLoadOlder={months < MAX_MONTHS}
        initialStatus={status}
      />
    </div>
  );
}

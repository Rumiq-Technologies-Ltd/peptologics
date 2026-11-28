import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { LocalTime } from "@/features/admin/orders/components/LocalTime";
import { OrderNotes } from "@/features/admin/orders/components/OrderNotes";
import { OrderStatusBadge } from "@/features/admin/orders/components/OrderStatusBadge";
import { OrderStatusChanger } from "@/features/admin/orders/components/OrderStatusChanger";
import {
  OrderCustomerCard,
  OrderEmailCard,
  OrderLinesCard,
} from "@/features/admin/orders/components/OrderSummaryCards";
import { OrderVisibilityControl } from "@/features/admin/orders/components/OrderVisibilityControl";
import { getOrderAdmin } from "@/features/admin/orders/services/container.server";
import { ORDER_NUMBER_PATTERN } from "@/features/admin/orders/validation/order.schema";
import { recordAudit } from "@/features/admin/services/audit.service";
import { requestId, requireAdmin } from "@/lib/admin/authorize.server";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderPage(props: PageProps<"/admin/orders/[orderNumber]">) {
  const session = await requireAdmin({ role: "editor" });

  const { orderNumber } = await props.params;
  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) notFound();

  const detail = await getOrderAdmin().getDetail(orderNumber);
  if (!detail) notFound();

  // This page shows personal data, so each visit is logged: who, and which order number.
  await recordAudit({
    actorEmail: session.email,
    actorRole: session.role,
    action: "order_viewed",
    target: orderNumber,
    requestId: await requestId(),
  });

  const { order, lines, notifications, notes } = detail;
  // A new lock version remounts the status control, so it always starts from what is saved.
  const lockKey = `${order.id}-${order.version}`;

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/admin/orders"
        className="text-ink-700 inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" /> All orders
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-ink-950 text-2xl font-bold">{order.orderNumber}</h1>
        <OrderStatusBadge status={order.status} />
        {order.deletedAt ? <Badge variant="outline">Hidden as test / spam</Badge> : null}
      </div>
      <p className="text-ink-700 mt-1 text-sm">
        Received <LocalTime value={order.createdAt} />
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <OrderCustomerCard order={order} />
          <OrderLinesCard order={order} lines={lines} />
          <OrderEmailCard notifications={notifications} />
        </div>
        <div className="space-y-6">
          <OrderStatusChanger
            key={lockKey}
            orderId={order.id}
            version={order.version}
            status={order.status}
          />
          <OrderNotes orderId={order.id} notes={notes} />
          <OrderVisibilityControl
            key={lockKey}
            orderId={order.id}
            orderNumber={order.orderNumber}
            version={order.version}
            hidden={order.deletedAt !== null}
          />
        </div>
      </div>
    </div>
  );
}

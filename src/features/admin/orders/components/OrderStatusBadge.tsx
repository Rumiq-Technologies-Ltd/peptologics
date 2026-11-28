import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/features/admin/orders/types";

const STATUS_STYLE: Record<OrderStatus, string> = {
  new: "bg-blue-100 text-blue-900",
  contacted: "bg-amber-100 text-amber-900",
  confirmed: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-ink-200 text-ink-800",
  completed: "bg-emerald-200 text-emerald-950",
};

/** The status as text on a tinted pill: the words carry the meaning, not the colour. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge className={STATUS_STYLE[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

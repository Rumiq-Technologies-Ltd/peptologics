"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MailWarningIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type AdminOrderSummary,
  type OrderStatus,
} from "@/features/admin/orders/types";
import {
  DEFAULT_ORDER_FILTERS,
  filterOrders,
  typedOrderNumber,
  type OrderListFilters,
} from "@/features/admin/orders/utils/orderList";
import { formatCurrency } from "@/utils/formatCurrency";

import { LocalTime } from "./LocalTime";
import { OrderStatusBadge } from "./OrderStatusBadge";

interface OrdersTableProps {
  orders: AdminOrderSummary[];
  /** How many months, counting back from this one, the server read. */
  months: number;
  /** False once the list has reached the oldest month it will read. */
  canLoadOlder: boolean;
  initialStatus: OrderStatus | "all";
}

const SELECT_CLASS =
  "border-input bg-background h-9 rounded-md border px-3 text-sm focus-visible:ring-[3px] focus-visible:ring-ring outline-none";

/**
 * The orders list. The server reads whole months (newest first); status, search and "Show
 * hidden" filter those months here, so they are instant. Older months load on request.
 */
export function OrdersTable({ orders, months, canLoadOlder, initialStatus }: OrdersTableProps) {
  const [filters, setFilters] = useState<OrderListFilters>({
    ...DEFAULT_ORDER_FILTERS,
    status: initialStatus,
  });

  const visible = useMemo(() => filterOrders(orders, filters), [orders, filters]);
  const typedNumber = typedOrderNumber(filters.search);

  function update<K extends keyof OrderListFilters>(key: K, value: OrderListFilters[K]): void {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <div>
      <h1 className="text-ink-950 text-2xl font-bold">Orders</h1>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-medium">
          Search
          <Input
            type="search"
            className="bg-white dark:bg-white"
            value={filters.search}
            onChange={(event) => update("search", event.target.value)}
            placeholder="Order number, name or email"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Status
          <select
            className={SELECT_CLASS}
            value={filters.status}
            onChange={(event) => update("status", event.target.value as OrderListFilters["status"])}
          >
            <option value="all">All</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {ORDER_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex h-9 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4"
            checked={filters.showHidden}
            onChange={(event) => update("showHidden", event.target.checked)}
          />
          Show hidden
        </label>
      </div>

      <p className="text-ink-700 mt-4 text-sm">
        Showing orders from {months === 1 ? "this month" : `the last ${months} months`}. Searching
        by name or email covers only these months; load older months to reach further back.
      </p>

      {typedNumber ? (
        <p className="mt-2 text-sm">
          <Link
            href={`/admin/orders/${typedNumber}`}
            className="text-primary font-medium underline underline-offset-4"
          >
            Open order {typedNumber}
          </Link>{" "}
          <span className="text-ink-700">(works for any month)</span>
        </p>
      ) : null}

      {visible.length === 0 ? (
        <div className="border-ink-200 mt-4 rounded-lg border bg-white p-8 text-center">
          <p className="text-ink-950 font-medium">
            {orders.length === 0 ? "No orders in this period yet." : "No orders match."}
          </p>
          <p className="text-ink-700 mt-1 text-sm">
            {orders.length === 0
              ? "New inquiries appear here as soon as customers submit them."
              : "Try a different search, or clear the filters."}
          </p>
          {orders.length > 0 ? (
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => setFilters(DEFAULT_ORDER_FILTERS)}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : (
        <div
          role="region"
          aria-label="Orders table"
          tabIndex={0}
          className="border-ink-200 mt-2 overflow-x-auto rounded-lg border bg-white"
        >
          <table className="w-full min-w-[48rem] text-left text-sm">
            <caption className="sr-only">Orders, newest first</caption>
            <thead className="border-ink-200 text-ink-600 border-b text-xs uppercase">
              <tr>
                <th scope="col" className="p-3">
                  Order
                </th>
                <th scope="col" className="p-3">
                  Date
                </th>
                <th scope="col" className="p-3">
                  Customer
                </th>
                <th scope="col" className="p-3 text-right">
                  Items
                </th>
                <th scope="col" className="p-3 text-right">
                  Total
                </th>
                <th scope="col" className="p-3">
                  Status
                </th>
                <th scope="col" className="p-3">
                  Email
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((order) => (
                <tr key={order.id} className="border-ink-100 border-b last:border-0">
                  <th scope="row" className="p-3 font-medium">
                    <Link
                      href={`/admin/orders/${order.orderNumber}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                    {order.deletedAt ? (
                      <Badge variant="outline" className="ml-2">
                        Hidden
                      </Badge>
                    ) : null}
                  </th>
                  <td className="p-3 whitespace-nowrap">
                    <LocalTime value={order.createdAt} />
                  </td>
                  <td className="p-3">{order.customerName}</td>
                  <td className="p-3 text-right">{order.itemCount}</td>
                  <td className="p-3 text-right">{formatCurrency(order.totalCents)}</td>
                  <td className="p-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="p-3">
                    {order.emailProblem ? (
                      <Badge className="bg-red-100 text-red-900">
                        <MailWarningIcon aria-hidden="true" /> Email problem
                      </Badge>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canLoadOlder ? (
        <Link
          href={`/admin/orders?months=${months + 1}`}
          scroll={false}
          className={buttonVariants({ variant: "outline", className: "mt-4" })}
        >
          Load older orders
        </Link>
      ) : (
        <p className="text-ink-700 mt-4 text-sm">That is as far back as the list goes.</p>
      )}
    </div>
  );
}

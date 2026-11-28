import { ORDER_NUMBER_PATTERN } from "@/features/admin/orders/validation/order.schema";
import type { AdminOrderSummary, OrderStatus } from "@/features/admin/orders/types";
import { ORDER_STATUSES } from "@/features/admin/orders/types";

export interface OrderListFilters {
  status: OrderStatus | "all";
  search: string;
  showHidden: boolean;
}

export const DEFAULT_ORDER_FILTERS: OrderListFilters = {
  status: "all",
  search: "",
  showHidden: false,
};

/** A status from the address bar, or "all" when it is missing or not one of the five. */
export function parseStatusFilter(value: string | undefined): OrderStatus | "all" {
  return ORDER_STATUSES.find((status) => status === value) ?? "all";
}

/**
 * Filters the orders already loaded. Search matches the order number, the customer's name or
 * their email, so it reaches only the months on screen (the page says so).
 */
export function filterOrders(
  orders: readonly AdminOrderSummary[],
  filters: OrderListFilters,
): AdminOrderSummary[] {
  const needle = filters.search.trim().toLowerCase();

  return orders.filter((order) => {
    if (!filters.showHidden && order.deletedAt) return false;
    if (filters.status !== "all" && order.status !== filters.status) return false;
    if (!needle) return true;

    return [order.orderNumber, order.customerName, order.email].some((field) =>
      field.toLowerCase().includes(needle),
    );
  });
}

/** The order number typed into the search box, normalised, when it is a whole one. */
export function typedOrderNumber(search: string): string | null {
  const candidate = search.trim().toUpperCase();
  return ORDER_NUMBER_PATTERN.test(candidate) ? candidate : null;
}

import { describe, expect, it } from "vitest";

import type { AdminOrderSummary } from "@/features/admin/orders/types";
import {
  DEFAULT_ORDER_FILTERS,
  filterOrders,
  parseStatusFilter,
  typedOrderNumber,
} from "@/features/admin/orders/utils/orderList";

function order(over: Partial<AdminOrderSummary>): AdminOrderSummary {
  return {
    id: "id",
    orderNumber: "PL-001001",
    createdAt: "2026-11-01T00:00:00.000Z",
    customerName: "Test Person",
    email: "test@example.com",
    itemCount: 1,
    totalCents: 5000,
    status: "new",
    deletedAt: null,
    emailProblem: false,
    ...over,
  };
}

const ORDERS = [
  order({ orderNumber: "PL-001001", customerName: "Ada Example", email: "ada@example.com" }),
  order({ orderNumber: "PL-001002", customerName: "Grace Example", status: "contacted" }),
  order({
    orderNumber: "PL-001003",
    customerName: "Hidden Spam",
    deletedAt: "2026-11-02T00:00:00Z",
  }),
];

describe("filterOrders", () => {
  it("hides test and spam orders by default and shows them on request", () => {
    expect(filterOrders(ORDERS, DEFAULT_ORDER_FILTERS)).toHaveLength(2);
    expect(filterOrders(ORDERS, { ...DEFAULT_ORDER_FILTERS, showHidden: true })).toHaveLength(3);
  });

  it("filters by status", () => {
    const result = filterOrders(ORDERS, { ...DEFAULT_ORDER_FILTERS, status: "contacted" });
    expect(result.map((o) => o.orderNumber)).toEqual(["PL-001002"]);
  });

  it("searches order number, name and email, ignoring case", () => {
    const search = (text: string) =>
      filterOrders(ORDERS, { ...DEFAULT_ORDER_FILTERS, search: text }).map((o) => o.orderNumber);

    expect(search("pl-001002")).toEqual(["PL-001002"]);
    expect(search("GRACE")).toEqual(["PL-001002"]);
    expect(search("ada@")).toEqual(["PL-001001"]);
    expect(search("nobody")).toEqual([]);
  });
});

describe("parseStatusFilter and typedOrderNumber", () => {
  it("accepts only the five statuses", () => {
    expect(parseStatusFilter("new")).toBe("new");
    expect(parseStatusFilter("bogus")).toBe("all");
    expect(parseStatusFilter(undefined)).toBe("all");
  });

  it("recognises a whole order number", () => {
    expect(typedOrderNumber(" pl-001032 ")).toBe("PL-001032");
    expect(typedOrderNumber("PL-12")).toBeNull();
    expect(typedOrderNumber("Ada")).toBeNull();
  });
});

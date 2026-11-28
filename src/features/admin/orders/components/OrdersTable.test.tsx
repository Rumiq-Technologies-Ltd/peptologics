import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { OrdersTable } from "@/features/admin/orders/components/OrdersTable";
import type { AdminOrderSummary } from "@/features/admin/orders/types";

function order(over: Partial<AdminOrderSummary>): AdminOrderSummary {
  return {
    id: "id",
    orderNumber: "PL-001001",
    createdAt: "2026-11-20T10:00:00.000Z",
    customerName: "Test Person",
    email: "test@example.test",
    itemCount: 2,
    totalCents: 12500,
    status: "new",
    deletedAt: null,
    emailProblem: false,
    ...over,
  };
}

const ORDERS = [
  order({ id: "1", orderNumber: "PL-001003", customerName: "Ada Example", emailProblem: true }),
  order({ id: "2", orderNumber: "PL-001002", customerName: "Grace Example", status: "contacted" }),
  order({
    id: "3",
    orderNumber: "PL-001001",
    customerName: "Spam Person",
    deletedAt: "2026-11-21T00:00:00.000Z",
  }),
];

function renderTable(over: Partial<React.ComponentProps<typeof OrdersTable>> = {}) {
  return render(
    <OrdersTable orders={ORDERS} months={1} canLoadOlder initialStatus="all" {...over} />,
  );
}

function rowNumbers(): string[] {
  return within(screen.getByRole("table"))
    .getAllByRole("rowheader")
    .map((cell) => cell.textContent?.replace("Hidden", "") ?? "");
}

describe("OrdersTable", () => {
  it("shows the columns, newest first as supplied, and hides test/spam by default", () => {
    renderTable();

    for (const name of ["Order", "Date", "Customer", "Items", "Total", "Status", "Email"]) {
      expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
    }
    expect(rowNumbers()).toEqual(["PL-001003", "PL-001002"]);
    expect(screen.getAllByText("$125")).toHaveLength(2);
  });

  it("badges an email problem on the order that has one, and only that one", () => {
    renderTable();

    expect(screen.getAllByText("Email problem")).toHaveLength(1);
    const row = screen.getByRole("link", { name: "PL-001003" }).closest("tr");
    expect(within(row as HTMLElement).getByText("Email problem")).toBeInTheDocument();
  });

  it("links each order number to its detail page", () => {
    renderTable();
    expect(screen.getByRole("link", { name: "PL-001002" })).toHaveAttribute(
      "href",
      "/admin/orders/PL-001002",
    );
  });

  it("filters by status", async () => {
    renderTable();

    await userEvent.selectOptions(screen.getByLabelText("Status"), "contacted");

    expect(rowNumbers()).toEqual(["PL-001002"]);
  });

  it("starts on the status from the address bar", () => {
    renderTable({ initialStatus: "contacted" });
    expect(rowNumbers()).toEqual(["PL-001002"]);
  });

  it("searches by order number, name and email", async () => {
    renderTable();
    const search = screen.getByLabelText("Search");

    await userEvent.type(search, "grace");
    expect(rowNumbers()).toEqual(["PL-001002"]);

    await userEvent.clear(search);
    await userEvent.type(search, "PL-001003");
    expect(rowNumbers()).toEqual(["PL-001003"]);
  });

  it("offers a direct link for a whole order number, for any month", async () => {
    renderTable();

    await userEvent.type(screen.getByLabelText("Search"), "pl-001999");

    expect(screen.getByRole("link", { name: "Open order PL-001999" })).toHaveAttribute(
      "href",
      "/admin/orders/PL-001999",
    );
  });

  it("brings hidden orders back with a Hidden label on the toggle", async () => {
    renderTable();

    await userEvent.click(screen.getByLabelText("Show hidden"));

    expect(rowNumbers()).toEqual(["PL-001003", "PL-001002", "PL-001001"]);
    expect(screen.getByText("Hidden")).toBeInTheDocument();
  });

  it("says that name and email search covers only the loaded months", () => {
    renderTable({ months: 3 });
    expect(screen.getByText(/the last 3 months/)).toBeInTheDocument();
    expect(screen.getByText(/covers only these months/)).toBeInTheDocument();
  });

  it("links to the next older month, and stops when there is no more", () => {
    const { unmount } = renderTable({ months: 2 });
    expect(screen.getByRole("link", { name: "Load older orders" })).toHaveAttribute(
      "href",
      "/admin/orders?months=3",
    );
    unmount();

    renderTable({ canLoadOlder: false });
    expect(screen.queryByRole("link", { name: "Load older orders" })).toBeNull();
  });

  it("shows an empty state with no orders, and a clear-filters state when none match", async () => {
    const { unmount } = renderTable({ orders: [] });
    expect(screen.getByText("No orders in this period yet.")).toBeInTheDocument();
    unmount();

    renderTable();
    await userEvent.type(screen.getByLabelText("Search"), "nobody");
    expect(screen.getByText("No orders match.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(rowNumbers()).toEqual(["PL-001003", "PL-001002"]);
  });

  it("is reachable by keyboard: search, status, toggle, then the first order link", async () => {
    renderTable();
    const user = userEvent.setup();

    await user.tab();
    expect(screen.getByLabelText("Search")).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("Status")).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("Show hidden")).toHaveFocus();
  });
});

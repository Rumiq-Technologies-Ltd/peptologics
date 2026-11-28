import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

const actions = vi.hoisted(() => ({
  reorderProductAction: vi.fn(),
  setProductFeaturedAction: vi.fn(),
  setProductStatusAction: vi.fn(),
}));
vi.mock("@/features/admin/products/actions/productActions", () => actions);

import { ProductsTable } from "@/features/admin/products/components/ProductsTable";
import type { AdminProduct } from "@/features/admin/products/types";

function product(id: string, over: Partial<AdminProduct> = {}): AdminProduct {
  return {
    id,
    slug: `p-${id}-10mg`,
    name: `Product ${id}`,
    description: null,
    category: "peptide",
    strength: 10,
    strengthUnit: "mg",
    priceCents: 5000,
    costPerMg: 5,
    isBlend: false,
    featured: false,
    sortOrder: Number(id) * 10,
    imageUrl: null,
    status: "active",
    version: 3,
    previousSlugs: [],
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...over,
  };
}

const PRODUCTS = [
  product("1", { name: "Alpha", featured: true }),
  product("2", { name: "Beta", category: "supply", status: "out_of_stock" }),
  product("3", { name: "Gamma", status: "archived" }),
];

beforeEach(() => {
  vi.clearAllMocks();
  for (const action of Object.values(actions)) {
    action.mockResolvedValue({ success: true, message: "Done." });
  }
});

function renderTable() {
  return render(<ProductsTable products={PRODUCTS} />);
}

const rowNames = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("link")[0]?.textContent);

describe("ProductsTable", () => {
  it("lists every product with its status, in display order", () => {
    renderTable();

    expect(rowNames()).toEqual(["Alpha", "Beta", "Gamma"]);
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Out of stock")).toBeInTheDocument();
    expect(table.getByText("Archived")).toBeInTheDocument();
  });

  it("searches by name and shows an empty state with a way back", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.type(screen.getByLabelText("Search by name"), "bet");
    expect(rowNames()).toEqual(["Beta"]);

    await user.clear(screen.getByLabelText("Search by name"));
    await user.type(screen.getByLabelText("Search by name"), "zzz");
    expect(screen.getByText("No products match.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(rowNames()).toHaveLength(3);
  });

  it("filters by status and category", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.selectOptions(screen.getByLabelText("Status"), "archived");
    expect(rowNames()).toEqual(["Gamma"]);

    await user.selectOptions(screen.getByLabelText("Status"), "all");
    await user.selectOptions(screen.getByLabelText("Category"), "supply");
    expect(rowNames()).toEqual(["Beta"]);
  });

  it("sorts by price", async () => {
    const user = userEvent.setup();
    render(
      <ProductsTable
        products={[
          product("1", { name: "Cheap", priceCents: 100 }),
          product("2", { name: "Dear", priceCents: 900 }),
        ]}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Sort by"), "price-desc");
    expect(rowNames()).toEqual(["Dear", "Cheap"]);
  });

  it("says which products the home page shows", () => {
    renderTable();
    expect(screen.getByText(/The home page shows/)).toHaveTextContent("Alpha");
  });

  it("reorders with labelled buttons, disabled at the ends and while filtered", async () => {
    const user = userEvent.setup();
    renderTable();

    expect(screen.getByRole("button", { name: "Move Alpha up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Gamma down" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Move Beta up" }));
    expect(actions.reorderProductAction).toHaveBeenCalledWith("2", "up");
    await waitFor(() => expect(refresh).toHaveBeenCalled());

    await user.type(screen.getByLabelText("Search by name"), "a");
    expect(screen.getByRole("button", { name: "Move Alpha down" })).toBeDisabled();
    expect(screen.getByText(/Clear the filters and sort by display order/)).toBeInTheDocument();
  });

  it("toggles featured with the product's saved version", async () => {
    const user = userEvent.setup();
    renderTable();

    const toggle = screen.getByRole("button", { name: "Mark Beta as featured" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);

    expect(actions.setProductFeaturedAction).toHaveBeenCalledWith("2", 3, true);
  });

  it("asks before archiving, and archives only on confirm", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getAllByRole("button", { name: "Archive" })[0] as HTMLElement);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Archive Alpha?")).toBeInTheDocument();
    expect(actions.setProductStatusAction).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Keep it" }));
    expect(actions.setProductStatusAction).not.toHaveBeenCalled();

    await user.click(screen.getAllByRole("button", { name: "Archive" })[0] as HTMLElement);
    await user.click(await screen.findByRole("button", { name: "Archive product" }));
    expect(actions.setProductStatusAction).toHaveBeenCalledWith("1", 3, "archived");
  });

  it("restores an archived product without a confirmation", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(actions.setProductStatusAction).toHaveBeenCalledWith("3", 3, "active");
  });

  it("shows a failed action's message and refreshes after a version conflict", async () => {
    const user = userEvent.setup();
    actions.setProductFeaturedAction.mockResolvedValue({
      success: false,
      code: "VERSION_CONFLICT",
      message: "This product changed since you opened it. Reload.",
    });
    renderTable();

    await user.click(screen.getByRole("button", { name: "Mark Beta as featured" }));

    expect(
      await screen.findByText("This product changed since you opened it. Reload."),
    ).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });
});

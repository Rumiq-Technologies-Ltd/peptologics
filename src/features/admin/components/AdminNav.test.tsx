import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminNav } from "@/features/admin/components/AdminNav";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));

describe("AdminNav", () => {
  it("shows Settings to an owner and hides it from an editor", () => {
    const { rerender } = render(<AdminNav role="owner" />);
    expect(screen.getByText("Settings")).toBeInTheDocument();

    rerender(<AdminNav role="editor" />);
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });

  it("lists every other item for an editor, in order", () => {
    render(<AdminNav role="editor" />);
    const labels = screen.getAllByRole("listitem").map((item) => item.textContent);

    expect(labels.map((label) => label?.replace("Coming soon", ""))).toEqual([
      "Home",
      "Products",
      "Orders",
      "Lab reports",
      "Content",
      "Discounts",
      "Customers",
    ]);
  });

  it("makes Home a current-page link and the unbuilt items disabled, non-focusable text", () => {
    render(<AdminNav role="owner" />);

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    // Home and Products (Phase 2) are links; the rest wait for their phase.
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute(
      "href",
      "/admin/products",
    );
    expect(screen.getByText("Orders").closest("[aria-disabled='true']")).not.toBeNull();
    expect(screen.getAllByText("Coming soon")).toHaveLength(6);
  });

  it("closes the drawer through onNavigate and is reachable by keyboard", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<AdminNav role="editor" onNavigate={onNavigate} />);

    await user.tab();
    expect(screen.getByRole("link", { name: "Home" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});

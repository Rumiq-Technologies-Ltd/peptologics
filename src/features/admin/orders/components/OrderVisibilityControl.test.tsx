import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const actions = vi.hoisted(() => ({ hideOrderAction: vi.fn(), restoreOrderAction: vi.fn() }));
vi.mock("@/features/admin/orders/actions/orderActions", () => actions);

import { OrderVisibilityControl } from "@/features/admin/orders/components/OrderVisibilityControl";

const ID = "11111111-1111-4111-8111-111111111111";

function renderControl(hidden: boolean) {
  return render(
    <OrderVisibilityControl orderId={ID} orderNumber="PL-001001" version={2} hidden={hidden} />,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("OrderVisibilityControl", () => {
  it("asks first, and does nothing if the dialog is cancelled", async () => {
    renderControl(false);

    await userEvent.click(screen.getByRole("button", { name: "Mark as test / spam" }));
    const dialog = screen.getByRole("dialog", { name: "Hide PL-001001 as test or spam?" });
    expect(dialog).toHaveTextContent("Nothing is deleted");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(actions.hideOrderAction).not.toHaveBeenCalled();
  });

  it("hides with the order's version once confirmed", async () => {
    actions.hideOrderAction.mockResolvedValue({
      success: true,
      message: "Order hidden as test or spam.",
    });
    renderControl(false);

    await userEvent.click(screen.getByRole("button", { name: "Mark as test / spam" }));
    await userEvent.click(screen.getByRole("button", { name: "Hide order" }));

    expect(actions.hideOrderAction).toHaveBeenCalledWith(ID, 2);
    expect(await screen.findByText("Order hidden as test or spam.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("offers Restore for a hidden order, behind its own confirmation", async () => {
    actions.restoreOrderAction.mockResolvedValue({ success: true, message: "Order restored." });
    renderControl(true);

    expect(screen.queryByRole("button", { name: "Mark as test / spam" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Restore order" }));
    expect(screen.getByRole("dialog", { name: "Restore PL-001001?" })).toBeInTheDocument();

    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Restore order" }),
    );

    expect(actions.restoreOrderAction).toHaveBeenCalledWith(ID, 2);
    expect(actions.hideOrderAction).not.toHaveBeenCalled();
  });

  it("closes on Escape without acting", async () => {
    renderControl(false);

    await userEvent.click(screen.getByRole("button", { name: "Mark as test / spam" }));
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(actions.hideOrderAction).not.toHaveBeenCalled();
  });

  it("reports a conflict and reloads", async () => {
    actions.hideOrderAction.mockResolvedValue({
      success: false,
      code: "VERSION_CONFLICT",
      message: "This order changed since you opened it. Reload.",
    });
    renderControl(false);

    await userEvent.click(screen.getByRole("button", { name: "Mark as test / spam" }));
    await userEvent.click(screen.getByRole("button", { name: "Hide order" }));

    expect(await screen.findByText(/changed since you opened it/)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });
});

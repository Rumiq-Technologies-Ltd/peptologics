import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const actions = vi.hoisted(() => ({ changeOrderStatusAction: vi.fn() }));
vi.mock("@/features/admin/orders/actions/orderActions", () => actions);

import { OrderStatusChanger } from "@/features/admin/orders/components/OrderStatusChanger";

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => vi.clearAllMocks());

describe("OrderStatusChanger", () => {
  it("lists the five statuses and keeps Save off until the choice differs", async () => {
    render(<OrderStatusChanger orderId={ID} version={0} status="new" />);

    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["New", "Contacted", "Confirmed", "Cancelled", "Completed"]);
    expect(screen.getByRole("button", { name: "Save status" })).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText("Order status"), "completed");
    expect(screen.getByRole("button", { name: "Save status" })).toBeEnabled();
  });

  it("saves any status with the order's version, reports it and refreshes", async () => {
    actions.changeOrderStatusAction.mockResolvedValue({ success: true, message: "Status saved." });
    render(<OrderStatusChanger orderId={ID} version={4} status="new" />);

    await userEvent.selectOptions(screen.getByLabelText("Order status"), "completed");
    await userEvent.click(screen.getByRole("button", { name: "Save status" }));

    expect(actions.changeOrderStatusAction).toHaveBeenCalledWith(ID, 4, "completed");
    expect(await screen.findByRole("status")).toHaveTextContent("Status saved.");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the conflict message and reloads the page's data", async () => {
    actions.changeOrderStatusAction.mockResolvedValue({
      success: false,
      code: "VERSION_CONFLICT",
      message: "This order changed since you opened it. Reload.",
    });
    render(<OrderStatusChanger orderId={ID} version={1} status="new" />);

    await userEvent.selectOptions(screen.getByLabelText("Order status"), "contacted");
    await userEvent.click(screen.getByRole("button", { name: "Save status" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "This order changed since you opened it. Reload.",
      ),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("does not refresh after another kind of failure", async () => {
    actions.changeOrderStatusAction.mockResolvedValue({
      success: false,
      code: "ERROR",
      message: "Unable to save the change. Please try again.",
    });
    render(<OrderStatusChanger orderId={ID} version={1} status="new" />);

    await userEvent.selectOptions(screen.getByLabelText("Order status"), "contacted");
    await userEvent.click(screen.getByRole("button", { name: "Save status" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Unable to save");
    expect(refresh).not.toHaveBeenCalled();
  });
});

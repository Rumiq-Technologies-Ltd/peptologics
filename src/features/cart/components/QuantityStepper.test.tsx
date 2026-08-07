import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MAX_LINE_QUANTITY } from "@/constants/business";
import { QuantityStepper } from "@/features/cart/components/QuantityStepper";

/**
 * The quantity control, tested the way a visitor meets it.
 *
 * Assertions go through accessible names rather than class names or test ids, so they
 * fail if the control becomes unusable to a screen reader — which is the failure mode
 * that would otherwise ship unnoticed.
 */

function renderStepper(props: Partial<React.ComponentProps<typeof QuantityStepper>> = {}) {
  const onChange = vi.fn();
  const onRemove = vi.fn();

  render(
    <QuantityStepper
      value={props.value ?? 2}
      itemLabel={props.itemLabel ?? "Retatrutide"}
      onChange={onChange}
      onRemove={onRemove}
      disabled={props.disabled}
    />,
  );

  return { onChange, onRemove, user: userEvent.setup() };
}

describe("QuantityStepper", () => {
  it("labels the group and both controls with the product name", () => {
    renderStepper();

    expect(screen.getByRole("group", { name: "Quantity of Retatrutide" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Decrease quantity of Retatrutide" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Increase quantity of Retatrutide" }),
    ).toBeInTheDocument();
  });

  it("increments and decrements by one", async () => {
    const { onChange, user } = renderStepper({ value: 2 });

    await user.click(screen.getByRole("button", { name: /Increase/ }));
    expect(onChange).toHaveBeenCalledWith(3);

    await user.click(screen.getByRole("button", { name: /Decrease/ }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("becomes a remove control at the minimum, in both name and action", async () => {
    // A minus that silently does nothing at 1 is the common pattern and the worse one:
    // it leaves no way to take the line off the list from here.
    const { onChange, onRemove, user } = renderStepper({ value: 1 });

    const remove = screen.getByRole("button", { name: "Remove Retatrutide from inquiry list" });
    await user.click(remove);

    expect(onRemove).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables increment at the cap and says why in its accessible name", async () => {
    const { onChange, user } = renderStepper({ value: MAX_LINE_QUANTITY });

    const increase = screen.getByRole("button", {
      name: `Maximum quantity of ${MAX_LINE_QUANTITY} reached for Retatrutide`,
    });

    expect(increase).toBeDisabled();
    await user.click(increase);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables both controls while the store is rehydrating", async () => {
    // Not cosmetic: a click landing mid-rehydration is discarded when the persisted
    // state merges in, so the visitor would watch their change vanish.
    const { onChange, onRemove, user } = renderStepper({ value: 2, disabled: true });

    await user.click(screen.getByRole("button", { name: /Increase/ }));
    await user.click(screen.getByRole("button", { name: /Decrease/ }));

    expect(onChange).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("announces the quantity through a live region", () => {
    renderStepper({ value: 7 });

    const live = screen.getByText("7", { selector: "[aria-live]" });
    expect(live).toHaveAttribute("aria-live", "polite");
    // Screen-reader-only context, so "7" is not announced as a bare number.
    expect(live).toHaveTextContent("7 on inquiry list");
  });
});

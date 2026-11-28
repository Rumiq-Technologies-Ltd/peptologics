import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const actions = vi.hoisted(() => ({ addOrderNoteAction: vi.fn() }));
vi.mock("@/features/admin/orders/actions/orderActions", () => actions);

import { OrderNotes } from "@/features/admin/orders/components/OrderNotes";
import type { AdminOrderNote } from "@/features/admin/orders/types";

const ID = "11111111-1111-4111-8111-111111111111";
const NOTES: AdminOrderNote[] = [
  {
    id: "n1",
    body: "Called, left a voicemail.",
    authorEmail: "owner@example.com",
    authorRole: "owner",
    createdAt: "2026-11-21T09:30:00.000Z",
  },
];

beforeEach(() => vi.clearAllMocks());

describe("OrderNotes", () => {
  it("lists each note with who wrote it and when, with no edit or delete control", () => {
    render(<OrderNotes orderId={ID} notes={NOTES} />);

    expect(screen.getByText("Called, left a voicemail.")).toBeInTheDocument();
    expect(screen.getByText(/owner@example.com/)).toBeInTheDocument();
    expect(document.querySelector("time")).toHaveAttribute("datetime", "2026-11-21T09:30:00.000Z");
    expect(screen.queryByRole("button", { name: /edit|delete|remove/i })).toBeNull();
  });

  it("says staff only", () => {
    render(<OrderNotes orderId={ID} notes={[]} />);
    expect(screen.getByText(/never shown to the customer or sent by email/)).toBeInTheDocument();
    expect(screen.getByText("No notes yet.")).toBeInTheDocument();
  });

  it("keeps Add note off until there is text, and counts characters", async () => {
    render(<OrderNotes orderId={ID} notes={[]} />);
    const button = screen.getByRole("button", { name: "Add note" });

    expect(button).toBeDisabled();
    expect(screen.getByText("0 / 2000")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Add a note"), "hello");
    expect(button).toBeEnabled();
    expect(screen.getByText("5 / 2000")).toBeInTheDocument();
  });

  it("adds a note, clears the box, confirms and refreshes", async () => {
    actions.addOrderNoteAction.mockResolvedValue({ success: true, message: "Note added." });
    render(<OrderNotes orderId={ID} notes={[]} />);

    const box = screen.getByLabelText("Add a note");
    await userEvent.type(box, "Spoke to them");
    await userEvent.click(screen.getByRole("button", { name: "Add note" }));

    expect(actions.addOrderNoteAction).toHaveBeenCalledWith(ID, "Spoke to them");
    expect(await screen.findByRole("status")).toHaveTextContent("Note added.");
    expect(box).toHaveValue("");
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps the text and shows the reason when the note is refused", async () => {
    actions.addOrderNoteAction.mockResolvedValue({
      success: false,
      code: "ERROR",
      message: "Unable to save the change. Please try again.",
    });
    render(<OrderNotes orderId={ID} notes={[]} />);

    const box = screen.getByLabelText("Add a note");
    await userEvent.type(box, "keep me");
    await userEvent.click(screen.getByRole("button", { name: "Add note" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Unable to save");
    expect(box).toHaveValue("keep me");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("limits the box to the maximum length", () => {
    render(<OrderNotes orderId={ID} notes={[]} />);
    expect(screen.getByLabelText("Add a note")).toHaveAttribute("maxlength", "2000");
  });
});

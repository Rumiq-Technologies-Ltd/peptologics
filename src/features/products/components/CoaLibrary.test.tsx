import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CoaLibrary } from "@/features/products/components/CoaLibrary";
import { makeProduct } from "@/test/factories";

/**
 * The COA dialog, tested the way a visitor meets it: by role and accessible name.
 * Radix supplies the focus trap; these tests pin the behaviour the dialog is responsible for.
 */

const products = [
  makeProduct({ id: "p1", slug: "tesamorelin-20mg", name: "Tesamorelin", strengthMg: 20 }),
  makeProduct({ id: "p2", slug: "pl3-30mg", name: "PL3", strengthMg: 30 }),
  makeProduct({ id: "p3", slug: "mots-c-10mg", name: "MOTS-c", strengthMg: 10 }),
  makeProduct({ id: "p4", slug: "no-coa-5mg", name: "NoCoa", strengthMg: 5 }),
];

function open(name: RegExp) {
  render(<CoaLibrary products={products} />);
  const user = userEvent.setup();
  const trigger = screen.getByRole("button", { name });
  return { user, trigger };
}

describe("CoaLibrary", () => {
  it("lists only products with a COA entry", () => {
    render(<CoaLibrary products={products} />);

    expect(screen.getAllByRole("button", { name: /^View COA/ })).toHaveLength(3);
    expect(screen.queryByText("NoCoa")).not.toBeInTheDocument();
  });

  it("opens a PDF report with Open PDF in a new tab and the exact Axiom link", async () => {
    const { user, trigger } = open(/^View COA\s*for MOTS-c/);
    await user.click(trigger);

    const dialog = screen.getByRole("dialog");
    const pdf = within(dialog).getByRole("link", { name: /Open PDF/ });
    expect(pdf).toHaveAttribute("href", "/coa/AX-2026-1759-FVQU.pdf");
    expect(pdf).toHaveAttribute("target", "_blank");
    expect(pdf).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(pdf).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    expect(within(dialog).getByRole("link", { name: /Verify with lab/ })).toHaveAttribute(
      "href",
      "https://axiomanalyticslab.com/verify?coa=AX-2026-1759-FVQU",
    );
    expect(within(dialog).getByText("99.51%")).toBeInTheDocument();
    expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();
  });

  it("offers the previous certificate where the two-lab rule applies, and can go back", async () => {
    const { user, trigger } = open(/^View COA\s*for Tesamorelin/);
    await user.click(trigger);

    await user.click(screen.getByRole("button", { name: "Previous certificate · 10 mg lot" }));
    expect(screen.getByText("Tesa10-260101-054")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to current certificate" }));
    expect(screen.getByText("TSM-260101-010")).toBeInTheDocument();
  });

  it("shows link-only reports with copyable codes, no file and no previous certificate", async () => {
    const { user, trigger } = open(/^View COA\s*for PL3/);
    await user.click(trigger);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("link", { name: /Verify with lab/ })).toHaveLength(2);
    expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: /Open (PDF|full size)/ })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /Previous certificate/ })).toBeNull();

    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await user.click(within(dialog).getAllByRole("button", { name: "Copy code" })[0]!);
    expect(writeText).toHaveBeenCalledWith("AX-2026-4286-S5HS");
    expect(within(dialog).getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("is labelled, closes on Escape, and returns focus to the row button", async () => {
    const { user, trigger } = open(/^View COA\s*for PL3/);
    await user.click(trigger);

    expect(screen.getByRole("dialog", { name: /PL3 — Certificate of Analysis/ })).toBeVisible();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("keeps focus inside the dialog when tabbing", async () => {
    const { user, trigger } = open(/^View COA\s*for PL3/);
    await user.click(trigger);

    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 8; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });
});

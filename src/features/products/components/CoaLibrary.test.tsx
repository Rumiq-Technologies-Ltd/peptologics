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
  makeProduct({ id: "p5", slug: "bpc-157-10mg", name: "BPC-157", strengthMg: 10 }),
  makeProduct({ id: "p6", slug: "pl3-10mg", name: "PL3", strengthMg: 10 }),
  makeProduct({ id: "p7", slug: "ss-31-10mg", name: "PL-31SS", strengthMg: 10 }),
];

/** The sticky header, where the one "Verify with lab" button lives beside the close X. */
function header(dialog: HTMLElement): HTMLElement {
  return dialog.querySelector<HTMLElement>('[data-slot="dialog-header"]')!;
}

function open(name: RegExp) {
  render(<CoaLibrary products={products} />);
  const user = userEvent.setup();
  const trigger = screen.getByRole("button", { name });
  return { user, trigger };
}

describe("CoaLibrary", () => {
  it("lists only products with a COA entry", () => {
    render(<CoaLibrary products={products} />);

    expect(screen.getAllByRole("button", { name: /^View COA/ })).toHaveLength(6);
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
    const { user, trigger } = open(/^View COA\s*for PL3 30 mg/);
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
    const { user, trigger } = open(/^View COA\s*for PL3 30 mg/);
    await user.click(trigger);

    expect(screen.getByRole("dialog", { name: /PL3 — Certificate of Analysis/ })).toBeVisible();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("keeps focus inside the dialog when tabbing", async () => {
    const { user, trigger } = open(/^View COA\s*for PL3 30 mg/);
    await user.click(trigger);

    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 8; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  describe("where Verify with lab appears", () => {
    it("hosted scan: header button, facts before the scan, then Open full size", async () => {
      const { user, trigger } = open(/^View COA\s*for BPC-157/);
      await user.click(trigger);

      const dialog = screen.getByRole("dialog");
      expect(within(header(dialog)).getAllByRole("link", { name: /Verify with lab/ })).toHaveLength(
        1,
      );
      expect(within(dialog).getAllByRole("link", { name: /Verify with lab/ })).toHaveLength(1);

      const facts = within(dialog).getByRole("heading", { name: "Bioviridian" });
      const scan = within(dialog).getByRole("img", { name: /Certificate of Analysis for BPC-157/ });
      expect(facts.compareDocumentPosition(scan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(within(dialog).getByRole("link", { name: /Open full size/ })).toBeInTheDocument();
    });

    it("hosted PDF: header button, no scan, Open PDF", async () => {
      const { user, trigger } = open(/^View COA\s*for MOTS-c/);
      await user.click(trigger);

      const dialog = screen.getByRole("dialog");
      expect(within(header(dialog)).getAllByRole("link", { name: /Verify with lab/ })).toHaveLength(
        1,
      );
      expect(within(dialog).getByRole("link", { name: /Open PDF/ })).toBeInTheDocument();
      expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();
    });

    it("previous certificate view: header button for its own lab", async () => {
      const { user, trigger } = open(/^View COA\s*for Tesamorelin/);
      await user.click(trigger);
      await user.click(screen.getByRole("button", { name: /Previous certificate/ }));

      const dialog = screen.getByRole("dialog");
      const link = within(header(dialog)).getByRole("link", {
        name: /Verify with lab, Bioviridian/,
      });
      expect(link).toHaveAttribute("href", "https://bioviridians.com/coa-search.html");
    });

    it("link-only, one lab: header button, facts only", async () => {
      const { user, trigger } = open(/^View COA\s*for PL3 10 mg/);
      await user.click(trigger);

      const dialog = screen.getByRole("dialog");
      expect(within(header(dialog)).getAllByRole("link", { name: /Verify with lab/ })).toHaveLength(
        1,
      );
      expect(within(dialog).getAllByRole("link", { name: /Verify with lab/ })).toHaveLength(1);
      expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();
      expect(within(dialog).queryByRole("link", { name: /Open (PDF|full size)/ })).toBeNull();
    });

    it("link-only, two labs: none in the header, one per lab strip", async () => {
      const { user, trigger } = open(/^View COA\s*for PL3 30 mg/);
      await user.click(trigger);

      const dialog = screen.getByRole("dialog");
      expect(within(header(dialog)).queryByRole("link", { name: /Verify with lab/ })).toBeNull();
      expect(within(dialog).getAllByRole("link", { name: /Verify with lab/ })).toHaveLength(2);
    });

    it("other-company report: no Verify anywhere, scan as today", async () => {
      const { user, trigger } = open(/^View COA\s*for PL-31SS/);
      await user.click(trigger);

      const dialog = screen.getByRole("dialog");
      expect(within(dialog).queryByRole("link", { name: /Verify with lab/ })).toBeNull();
      expect(
        within(dialog).getByRole("img", { name: /Certificate of Analysis/ }),
      ).toBeInTheDocument();
    });
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

const actions = vi.hoisted(() => ({
  createProductAction: vi.fn(),
  updateProductAction: vi.fn(),
  setProductStatusAction: vi.fn(),
  requestImageUploadAction: vi.fn(),
  finalizeImageUploadAction: vi.fn(),
}));
vi.mock("@/features/admin/products/actions/productActions", () => actions);

import { ProductForm } from "@/features/admin/products/components/ProductForm";
import type { AdminProduct } from "@/features/admin/products/types";

const EXISTING: AdminProduct = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "bpc-157-10mg",
  name: "BPC-157",
  description: null,
  category: "peptide",
  strength: 10,
  strengthUnit: "mg",
  priceCents: 5000,
  costPerMg: 5,
  isBlend: false,
  featured: false,
  sortOrder: 20,
  imageUrl: null,
  status: "active",
  version: 4,
  previousSlugs: [],
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};

beforeEach(() => vi.clearAllMocks());

describe("ProductForm (add)", () => {
  it("explains what is missing instead of submitting", async () => {
    const user = userEvent.setup();
    render(<ProductForm defaultSortOrder={100} uploadEnabled={false} />);

    await user.click(screen.getByRole("button", { name: "Add product" }));

    expect(await screen.findByText("Enter the product name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a web address for the product.")).toBeInTheDocument();
    expect(actions.createProductAction).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
  });

  it("suggests the web address from the name and size until it is edited by hand", async () => {
    const user = userEvent.setup();
    render(<ProductForm defaultSortOrder={100} uploadEnabled={false} />);

    await user.type(screen.getByLabelText("Name"), "BPC-157");
    await user.type(screen.getByLabelText("Vial size"), "10");
    await user.tab();
    expect(screen.getByLabelText("Web address")).toHaveValue("bpc-157-10mg");

    await user.clear(screen.getByLabelText("Web address"));
    await user.type(screen.getByLabelText("Web address"), "my-own");
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Other");
    await user.tab();
    expect(screen.getByLabelText("Web address")).toHaveValue("my-own");
  });

  it("works out cost per milligram instead of asking for it", async () => {
    const user = userEvent.setup();
    render(<ProductForm defaultSortOrder={100} uploadEnabled={false} />);

    expect(screen.queryByLabelText(/cost per/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Vial size"), "10");
    await user.clear(screen.getByLabelText("Price (USD)"));
    await user.type(screen.getByLabelText("Price (USD)"), "50");

    expect(screen.getByText(/Cost per mg: \$5\.00/)).toBeInTheDocument();
  });

  it("sends the typed values to the server action and shows its message", async () => {
    const user = userEvent.setup();
    actions.createProductAction.mockResolvedValue({
      success: true,
      message: "Saved. The product page goes live in about 5 minutes.",
      product: { ...EXISTING, version: 1 },
    });
    render(<ProductForm defaultSortOrder={100} uploadEnabled={false} />);

    await user.type(screen.getByLabelText("Name"), "BPC-157");
    await user.type(screen.getByLabelText("Vial size"), "10");
    await user.tab();
    await user.clear(screen.getByLabelText("Price (USD)"));
    await user.type(screen.getByLabelText("Price (USD)"), "50");
    await user.click(screen.getByRole("button", { name: "Add product" }));

    await waitFor(() => expect(actions.createProductAction).toHaveBeenCalled());
    expect(actions.createProductAction.mock.calls[0]?.[0]).toMatchObject({
      name: "BPC-157",
      slug: "bpc-157-10mg",
      strength: 10,
      price: 50,
      sortOrder: 100,
      status: "active",
    });
    expect(
      await screen.findByText("Saved. The product page goes live in about 5 minutes."),
    ).toBeInTheDocument();
  });

  it("puts a server field error next to its field", async () => {
    const user = userEvent.setup();
    actions.createProductAction.mockResolvedValue({
      success: false,
      code: "SLUG_TAKEN",
      message: "That web address is already used by another product.",
      fieldErrors: { slug: ["That web address is already used by another product."] },
    });
    render(<ProductForm defaultSortOrder={100} uploadEnabled={false} />);

    await user.type(screen.getByLabelText("Name"), "BPC-157");
    await user.type(screen.getByLabelText("Vial size"), "10");
    await user.tab();
    await user.clear(screen.getByLabelText("Price (USD)"));
    await user.type(screen.getByLabelText("Price (USD)"), "50");
    await user.click(screen.getByRole("button", { name: "Add product" }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.some((alert) => alert.id === "slug-error")).toBe(true);
  });
});

describe("ProductForm (edit)", () => {
  it("saves with the version it was opened with", async () => {
    const user = userEvent.setup();
    actions.updateProductAction.mockResolvedValue({
      success: true,
      message: "Saved.",
      product: { ...EXISTING, name: "BPC-157 Pro", version: 5 },
    });
    render(<ProductForm product={EXISTING} defaultSortOrder={20} uploadEnabled={false} />);

    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    await user.type(screen.getByLabelText("Name"), " Pro");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(actions.updateProductAction).toHaveBeenCalled());
    expect(actions.updateProductAction.mock.calls[0]?.[0]).toBe(EXISTING.id);
    expect(actions.updateProductAction.mock.calls[0]?.[1]).toBe(4);
  });

  it("shows the conflict message with a Reload button when someone else saved first", async () => {
    const user = userEvent.setup();
    actions.updateProductAction.mockResolvedValue({
      success: false,
      code: "VERSION_CONFLICT",
      message: "This product changed since you opened it. Reload.",
    });
    render(<ProductForm product={EXISTING} defaultSortOrder={20} uploadEnabled={false} />);

    await user.type(screen.getByLabelText("Name"), "x");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("This product changed since you opened it. Reload."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });

  it("warns that a changed web address keeps the old link working", async () => {
    const user = userEvent.setup();
    render(<ProductForm product={EXISTING} defaultSortOrder={20} uploadEnabled={false} />);

    expect(screen.queryByText(/keeps the old link working/)).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("Web address"));
    await user.type(screen.getByLabelText("Web address"), "bpc-157-20mg");

    expect(screen.getByText(/keeps the old link working/)).toBeInTheDocument();
    expect(
      screen.getByText(/do not reuse the address of a product that was renamed/),
    ).toBeInTheDocument();
  });

  it("offers Restore on an archived product", async () => {
    const user = userEvent.setup();
    actions.setProductStatusAction.mockResolvedValue({
      success: true,
      message: "Restored.",
      product: { ...EXISTING, status: "active", version: 6 },
    });
    render(
      <ProductForm
        product={{ ...EXISTING, status: "archived" }}
        defaultSortOrder={20}
        uploadEnabled={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(actions.setProductStatusAction).toHaveBeenCalledWith(EXISTING.id, 4, "active");
  });
});

describe("ProductForm image", () => {
  it("says so when image upload is not set up", () => {
    render(<ProductForm defaultSortOrder={100} uploadEnabled={false} />);
    expect(screen.getByText("Photo upload is not set up in this environment.")).toBeInTheDocument();
  });

  it("refuses a wrong file type in the browser before asking for an upload", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<ProductForm defaultSortOrder={100} uploadEnabled />);

    const input = screen.getByLabelText("Upload photo", { selector: "input" });
    await user.upload(input, new File(["x"], "doc.pdf", { type: "application/pdf" }));

    expect(await screen.findByText("Use a JPEG, PNG or WebP image.")).toBeInTheDocument();
    expect(actions.requestImageUploadAction).not.toHaveBeenCalled();
  });

  it("uploads straight to S3, then asks the server to check the file", async () => {
    const user = userEvent.setup();
    actions.requestImageUploadAction.mockResolvedValue({
      success: true,
      key: "uploads/abc",
      url: "https://bucket.s3.us-east-1.amazonaws.com/uploads/abc?sig=1",
      headers: { "Content-Type": "image/png", "Content-Length": "1" },
    });
    actions.finalizeImageUploadAction.mockResolvedValue({
      success: true,
      imageUrl: "https://media.example.com/products/new.webp",
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ProductForm defaultSortOrder={100} uploadEnabled />);
    await user.upload(
      screen.getByLabelText("Upload photo", { selector: "input" }),
      new File(["x"], "vial.png", { type: "image/png" }),
    );

    await waitFor(() =>
      expect(actions.finalizeImageUploadAction).toHaveBeenCalledWith("uploads/abc"),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://bucket.s3.us-east-1.amazonaws.com/uploads/abc?sig=1",
      expect.objectContaining({ method: "PUT", headers: { "Content-Type": "image/png" } }),
    );
    // The uploaded image is now the form's photo, so the control offers to replace it.
    expect(await screen.findByText("Replace photo")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

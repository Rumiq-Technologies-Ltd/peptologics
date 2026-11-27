import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductImage } from "@/features/products/components/ProductImage";
import { makeProduct } from "@/test/factories";

describe("ProductImage", () => {
  it("names the vial by compound and size when the product has an image", () => {
    const product = makeProduct({
      name: "PL3",
      strengthMg: 10,
      imageUrl: "/products/pl3-10mg.webp",
    });
    render(<ProductImage product={product} sizes="64px" />);

    expect(screen.getByRole("img", { name: "PL3 10 mg vial" })).toBeInTheDocument();
  });

  it("falls back to the brand glyph, with no broken image, when there is no image", () => {
    const product = makeProduct({ name: "PL3", imageUrl: null });
    const { container } = render(<ProductImage product={product} sizes="64px" />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

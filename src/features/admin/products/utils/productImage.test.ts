import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { MAX_IMAGE_BYTES, OUTPUT_IMAGE_SIDE } from "@/features/admin/products/utils/imageRules";
import { processProductImage } from "@/features/admin/products/utils/productImage";

async function image(
  width: number,
  height: number,
  format: "jpeg" | "png" | "webp" | "gif" = "png",
  orientation?: number,
): Promise<Buffer> {
  let pipeline = sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 160, b: 200 } },
  });
  if (orientation) pipeline = pipeline.withMetadata({ orientation });
  return pipeline.toFormat(format).toBuffer();
}

describe("processProductImage", () => {
  it("accepts a square image and returns a WebP no larger than 1200 px", async () => {
    const result = await processProductImage(await image(2000, 2000, "jpeg"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const meta = await sharp(result.webp).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(OUTPUT_IMAGE_SIDE);
    expect(meta.height).toBe(OUTPUT_IMAGE_SIDE);
  });

  it("does not enlarge a small but allowed image", async () => {
    const result = await processProductImage(await image(800, 800, "png"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((await sharp(result.webp).metadata()).width).toBe(800);
  });

  it("accepts a nearly square image at the edge of the ratio", async () => {
    expect((await processProductImage(await image(1100, 1000))).ok).toBe(true);
    expect((await processProductImage(await image(900, 1000))).ok).toBe(true);
  });

  it("refuses an image that is clearly not square", async () => {
    const result = await processProductImage(await image(1600, 1000));
    expect(result).toEqual({
      ok: false,
      message: "The image must be square, or very nearly square.",
    });
  });

  it("refuses an image under 600 px or over 4000 px", async () => {
    for (const side of [599, 4001]) {
      const result = await processProductImage(await image(side, side));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain("between 600 and 4000 pixels");
    }
  });

  it("refuses a format that is not JPEG, PNG or WebP, whatever the name said", async () => {
    const result = await processProductImage(await image(1000, 1000, "gif"));
    expect(result).toEqual({ ok: false, message: "Use a JPEG, PNG or WebP image." });
  });

  it("refuses bytes that are not an image", async () => {
    const result = await processProductImage(Buffer.from("<script>alert(1)</script>".repeat(40)));
    expect(result.ok).toBe(false);
  });

  it("refuses an empty file and one over 5 MB", async () => {
    expect((await processProductImage(Buffer.alloc(0))).ok).toBe(false);

    const tooBig = await processProductImage(Buffer.alloc(MAX_IMAGE_BYTES + 1));
    expect(tooBig).toEqual({ ok: false, message: "The image must be 5 MB or smaller." });
  });

  it("measures a sideways photo after applying its rotation", async () => {
    // Stored 1000x1500 with a 90-degree rotation flag: upright it is 1500x1000, not square.
    const result = await processProductImage(await image(1000, 1500, "jpeg", 6));
    expect(result.ok).toBe(false);
  });
});

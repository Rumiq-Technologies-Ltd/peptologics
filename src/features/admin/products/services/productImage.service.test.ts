import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import { createProductImageService } from "@/features/admin/products/services/productImage.service";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const BASE = "https://media.example.com";

let s3: ReturnType<typeof mockClient>;
let ids: string[];

function service() {
  const client = new S3Client({
    region: "us-east-1",
    credentials: {
      accessKeyId: "AKIATESTTESTTESTTEST",
      secretAccessKey: "test-secret-test-secret",
    },
  });
  return createProductImageService({
    client,
    bucket: "peptologics-media-test",
    baseUrl: BASE,
    newId: () => ids.shift() ?? UUID_B,
  });
}

function body(bytes: Buffer) {
  return { transformToByteArray: async () => new Uint8Array(bytes) } as never;
}

beforeEach(() => {
  s3 = mockClient(S3Client);
  ids = [UUID_A, UUID_B];
});

afterEach(() => s3.restore());

describe("createUploadTicket", () => {
  it("signs the exact type and size, so S3 refuses anything else", async () => {
    const result = await service().createUploadTicket({ contentType: "image/png", size: 1234 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.key).toBe(`uploads/${UUID_A}`);
    expect(result.data.headers).toEqual({ "Content-Type": "image/png", "Content-Length": "1234" });

    const url = new URL(result.data.url);
    expect(url.hostname).toBe("peptologics-media-test.s3.us-east-1.amazonaws.com");
    expect(url.pathname).toBe(`/uploads/${UUID_A}`);
    const signed = url.searchParams.get("X-Amz-SignedHeaders") ?? "";
    expect(signed).toContain("content-type");
    expect(signed).toContain("content-length");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
  });

  it("refuses a type or size outside the rules", async () => {
    const images = service();

    expect(await images.createUploadTicket({ contentType: "image/gif", size: 10 })).toMatchObject({
      success: false,
      message: "Use a JPEG, PNG or WebP image.",
    });
    expect(
      await images.createUploadTicket({ contentType: "image/png", size: 5 * 1024 * 1024 + 1 }),
    ).toMatchObject({ success: false, message: "The image must be 5 MB or smaller." });
    expect(await images.createUploadTicket({ contentType: "image/png", size: 0 })).toMatchObject({
      success: false,
    });
  });
});

describe("finalizeUpload", () => {
  const key = `uploads/${UUID_B}`;

  it("only reads keys it could have issued", async () => {
    for (const bad of ["products/x.webp", "uploads/../secrets", "uploads/abc", ""]) {
      expect(await service().finalizeUpload(bad)).toMatchObject({ success: false });
    }
    expect(s3.calls()).toHaveLength(0);
  });

  it("checks, converts and stores a good image, then removes the upload", async () => {
    const png = await sharp({
      create: { width: 1000, height: 1000, channels: 3, background: "#88a" },
    })
      .png()
      .toBuffer();
    s3.on(HeadObjectCommand).resolves({ ContentLength: png.length });
    s3.on(GetObjectCommand).resolves({ Body: body(png) });
    s3.on(PutObjectCommand).resolves({});
    s3.on(DeleteObjectCommand).resolves({});

    const result = await service().finalizeUpload(key);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.imageUrl).toBe(`${BASE}/products/${UUID_A}.webp`);

    const put = s3.commandCalls(PutObjectCommand)[0]?.args[0].input;
    expect(put).toMatchObject({
      Key: `products/${UUID_A}.webp`,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    });
    expect(s3.commandCalls(DeleteObjectCommand)[0]?.args[0].input.Key).toBe(key);
  });

  it("deletes an upload that fails the rules and stores nothing", async () => {
    const wide = await sharp({
      create: { width: 1600, height: 800, channels: 3, background: "#888" },
    })
      .png()
      .toBuffer();
    s3.on(HeadObjectCommand).resolves({ ContentLength: wide.length });
    s3.on(GetObjectCommand).resolves({ Body: body(wide) });
    s3.on(DeleteObjectCommand).resolves({});

    const result = await service().finalizeUpload(key);

    expect(result).toMatchObject({
      success: false,
      message: "The image must be square, or very nearly square.",
    });
    expect(s3.commandCalls(PutObjectCommand)).toHaveLength(0);
    expect(s3.commandCalls(DeleteObjectCommand)).toHaveLength(1);
  });

  it("refuses an object over 5 MB without downloading it", async () => {
    s3.on(HeadObjectCommand).resolves({ ContentLength: 6 * 1024 * 1024 });
    s3.on(DeleteObjectCommand).resolves({});

    const result = await service().finalizeUpload(key);

    expect(result).toMatchObject({ success: false });
    expect(s3.commandCalls(GetObjectCommand)).toHaveLength(0);
  });

  it("answers plainly when S3 fails", async () => {
    s3.on(HeadObjectCommand).rejects(new Error("NoSuchKey"));
    expect(await service().finalizeUpload(key)).toMatchObject({
      success: false,
      message: "Unable to process the image. Please try again.",
    });
  });
});

describe("isAllowedImageUrl", () => {
  it("accepts site images and this bucket's converted images only", () => {
    const images = service();

    expect(images.isAllowedImageUrl("/products/bpc-157-10mg.webp")).toBe(true);
    expect(images.isAllowedImageUrl(`${BASE}/products/${UUID_A}.webp`)).toBe(true);
    expect(images.isAllowedImageUrl(`${BASE}/uploads/${UUID_A}`)).toBe(false);
    expect(images.isAllowedImageUrl(`https://evil.example.com/products/${UUID_A}.webp`)).toBe(
      false,
    );
    expect(images.isAllowedImageUrl("/other/x.webp")).toBe(false);
  });
});

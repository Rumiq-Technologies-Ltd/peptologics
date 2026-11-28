import sharp from "sharp";

import {
  type AllowedImageType,
  MAX_ASPECT_RATIO,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_SIDE,
  MIN_ASPECT_RATIO,
  MIN_IMAGE_SIDE,
  OUTPUT_IMAGE_SIDE,
} from "./imageRules";

/**
 * Product image rules (D35 / owner, 2026-11-28). Pure and server-side: the browser's own checks
 * are a convenience, these are the ones that count.
 *
 * Every upload is decoded and re-encoded as a WebP. That fixes the format whatever the file
 * claimed to be, applies the camera's rotation, and drops EXIF and any hidden payload, so the
 * site only ever serves bytes it produced itself.
 */

const WEBP_QUALITY = 85;
/** Stops a decompression bomb: a tiny file that expands to a huge raster. */
const MAX_INPUT_PIXELS = MAX_IMAGE_SIDE * MAX_IMAGE_SIDE;

const SHARP_FORMATS: Record<string, AllowedImageType> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function isWithinSideLimits(width: number, height: number): boolean {
  return Math.min(width, height) >= MIN_IMAGE_SIDE && Math.max(width, height) <= MAX_IMAGE_SIDE;
}

const SIDE_LIMIT_FAILURE = {
  ok: false,
  message: `The image must be between ${MIN_IMAGE_SIDE} and ${MAX_IMAGE_SIDE} pixels on each side.`,
} as const;

export type ImageCheck =
  { ok: true; webp: Buffer; width: number; height: number } | { ok: false; message: string };

/** Decodes the bytes, checks them against the rules and returns the WebP to store. */
export async function processProductImage(input: Buffer): Promise<ImageCheck> {
  if (input.length === 0 || input.length > MAX_IMAGE_BYTES) {
    return { ok: false, message: "The image must be 5 MB or smaller." };
  }

  try {
    // The header alone says what the file is and how big: checked before any pixel is decoded,
    // so an oversized image is refused cheaply and with the right message.
    const meta = await sharp(input).metadata();
    if (!meta.format || !SHARP_FORMATS[meta.format]) {
      return { ok: false, message: "Use a JPEG, PNG or WebP image." };
    }
    if (!isWithinSideLimits(meta.width ?? 0, meta.height ?? 0)) return SIDE_LIMIT_FAILURE;

    // `rotate()` applies EXIF orientation first, so a sideways phone photo is measured upright.
    const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .toBuffer({ resolveWithObject: true });

    const { width, height } = info;
    if (!isWithinSideLimits(width, height)) return SIDE_LIMIT_FAILURE;

    const ratio = width / height;
    if (ratio < MIN_ASPECT_RATIO || ratio > MAX_ASPECT_RATIO) {
      return { ok: false, message: "The image must be square, or very nearly square." };
    }

    const webp = await sharp(data)
      .resize({
        width: OUTPUT_IMAGE_SIDE,
        height: OUTPUT_IMAGE_SIDE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    return { ok: true, webp, width, height };
  } catch {
    // Not decodable, truncated, or over the pixel limit: all the same answer to staff.
    return { ok: false, message: "That file could not be read as an image." };
  }
}

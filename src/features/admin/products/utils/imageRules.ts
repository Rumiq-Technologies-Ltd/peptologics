/**
 * Product image rules (owner, 2026-11-28), with nothing server-only in them, so the upload
 * control in the browser and the server read the same numbers. The checks that count run on the
 * server in `productImage.ts`.
 */

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MIN_IMAGE_SIDE = 600;
export const MAX_IMAGE_SIDE = 4000;
export const OUTPUT_IMAGE_SIDE = 1200;
/** Width divided by height must be inside this range: "square-ish". */
export const MIN_ASPECT_RATIO = 0.9;
export const MAX_ASPECT_RATIO = 1.1;

export function isAllowedImageType(value: string): value is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(value);
}

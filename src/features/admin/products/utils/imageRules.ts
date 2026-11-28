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

/** A file name inside `/products/`: starts with a letter or digit, so never `.` or `..`. */
const PRODUCT_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Whether a product's `imageUrl` may be stored: a site path `/products/<file>` (the images
 * shipped in `public/products`), or an address under the media CDN, `<base>/products/<file>`.
 * Nothing else: not another host, not a protocol-relative `//host/...`, not a nested path.
 */
export function isProductImageReference(value: string, mediaBaseUrl: string | undefined): boolean {
  if (value.startsWith("/products/")) return PRODUCT_FILE.test(value.slice("/products/".length));

  if (!mediaBaseUrl) return false;
  const prefix = `${mediaBaseUrl}/products/`;
  return value.startsWith(prefix) && PRODUCT_FILE.test(value.slice(prefix.length));
}

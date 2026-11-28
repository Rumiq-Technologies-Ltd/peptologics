import { randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { MAX_IMAGE_BYTES, isAllowedImageType } from "@/features/admin/products/utils/imageRules";
import { processProductImage } from "@/features/admin/products/utils/productImage";
import { logger } from "@/lib/logger";
import { fail, ok, type ServiceResult } from "@/types/result";

/**
 * Product image upload (admin Phase 2).
 *
 * 1. `createUploadTicket`: a presigned PUT to `uploads/<uuid>` for exactly the declared type and size.
 * 2. The browser PUTs the file straight to S3.
 * 3. `finalizeUpload`: reads the object, checks it (type by content, size, dimensions), re-encodes it
 *    as a WebP into `products/<uuid>.webp` and deletes the upload. A rejected upload is deleted too.
 *
 * Only `products/*` is served (through CloudFront), so an unchecked upload is never public.
 */

export const UPLOAD_PREFIX = "uploads/";
export const PRODUCT_IMAGE_PREFIX = "products/";
const UPLOAD_KEY_PATTERN =
  /^uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TICKET_LIFETIME_SECONDS = 300;
/** A year, and `immutable`: a replaced image gets a new key, so nothing is ever purged. */
const IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";

export interface UploadTicket {
  key: string;
  url: string;
  /** The headers the browser must send, exactly. */
  headers: { "Content-Type": string; "Content-Length": string };
}

export interface ProductImageDeps {
  client: S3Client;
  bucket: string;
  /** The public CloudFront address, no trailing slash. */
  baseUrl: string;
  newId?: () => string;
}

export interface ProductImageService {
  createUploadTicket(input: {
    contentType: string;
    size: number;
  }): Promise<ServiceResult<UploadTicket>>;
  finalizeUpload(key: string): Promise<ServiceResult<{ imageUrl: string; key: string }>>;
  /** True for an address this service could have produced, or a site path under `/products/`. */
  isAllowedImageUrl(url: string): boolean;
}

export function createProductImageService({
  client,
  bucket,
  baseUrl,
  newId = randomUUID,
}: ProductImageDeps): ProductImageService {
  async function discard(key: string): Promise<void> {
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (error) {
      // The bucket expires `uploads/` after a day anyway, so a failed delete is not an error.
      logger.warn("product_image_discard_failed", {
        error: error instanceof Error ? error.name : "unknown",
      });
    }
  }

  return {
    async createUploadTicket({ contentType, size }): Promise<ServiceResult<UploadTicket>> {
      if (!isAllowedImageType(contentType)) {
        return fail("VALIDATION_FAILED", "Use a JPEG, PNG or WebP image.");
      }
      if (!Number.isInteger(size) || size <= 0 || size > MAX_IMAGE_BYTES) {
        return fail("VALIDATION_FAILED", "The image must be 5 MB or smaller.");
      }

      const key = `${UPLOAD_PREFIX}${newId()}`;

      try {
        const url = await getSignedUrl(
          client,
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ContentType: contentType,
            ContentLength: size,
          }),
          {
            expiresIn: TICKET_LIFETIME_SECONDS,
            // Signing these makes S3 refuse a different type or size than was approved here.
            signableHeaders: new Set(["content-type", "content-length"]),
          },
        );

        return ok({
          key,
          url,
          headers: { "Content-Type": contentType, "Content-Length": String(size) },
        });
      } catch (error) {
        logger.error("product_image_ticket_failed", {
          error: error instanceof Error ? error.name : "unknown",
        });
        return fail("UNEXPECTED", "Unable to start the upload. Please try again.");
      }
    },

    async finalizeUpload(key): Promise<ServiceResult<{ imageUrl: string; key: string }>> {
      // The key comes from the browser: only an upload this service could have issued is read.
      if (!UPLOAD_KEY_PATTERN.test(key)) {
        return fail("VALIDATION_FAILED", "That upload is not valid.");
      }

      try {
        const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        if (!head.ContentLength || head.ContentLength > MAX_IMAGE_BYTES) {
          await discard(key);
          return fail("VALIDATION_FAILED", "The image must be 5 MB or smaller.");
        }

        const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const bytes = Buffer.from((await object.Body?.transformToByteArray()) ?? []);

        const checked = await processProductImage(bytes);
        if (!checked.ok) {
          await discard(key);
          return fail("VALIDATION_FAILED", checked.message);
        }

        const imageKey = `${PRODUCT_IMAGE_PREFIX}${newId()}.webp`;
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: imageKey,
            Body: checked.webp,
            ContentType: "image/webp",
            CacheControl: IMAGE_CACHE_CONTROL,
          }),
        );
        await discard(key);

        return ok({ imageUrl: `${baseUrl}/${imageKey}`, key: imageKey });
      } catch (error) {
        logger.error("product_image_finalize_failed", {
          error: error instanceof Error ? error.name : "unknown",
        });
        return fail("UNEXPECTED", "Unable to process the image. Please try again.");
      }
    },

    isAllowedImageUrl(url): boolean {
      return (
        /^\/products\/[A-Za-z0-9._-]+$/.test(url) ||
        new RegExp(`^${escapeRegExp(baseUrl)}/${PRODUCT_IMAGE_PREFIX}[0-9a-f-]{36}\\.webp$`).test(
          url,
        )
      );
    },
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

import "server-only";

import { createProductImageService, type ProductImageService } from "./productImage.service";
import { createProductAdminService, type ProductAdminService } from "./productAdmin.service";
import { createDynamoProductAdminRepository } from "./productAdmin.repository.dynamodb";
import { isProductImageReference } from "@/features/admin/products/utils/imageRules";
import { getS3Client } from "@/lib/aws/s3.server";
import { env } from "@/lib/env";

/**
 * Wires the admin product services once per server instance. The admin runs on DynamoDB only
 * (D35), so unlike the public catalog there is no Supabase variant to choose.
 */
interface ProductAdminContainer {
  products: ProductAdminService;
  /** Null when no media bucket is configured: image upload is then off. */
  images: ProductImageService | null;
}

let container: ProductAdminContainer | undefined;

export function getProductAdmin(): ProductAdminContainer {
  if (container) return container;

  const images =
    env.NEXT_PUBLIC_MEDIA_BUCKET_NAME && env.NEXT_PUBLIC_MEDIA_BASE_URL
      ? createProductImageService({
          client: getS3Client(),
          bucket: env.NEXT_PUBLIC_MEDIA_BUCKET_NAME,
          baseUrl: env.NEXT_PUBLIC_MEDIA_BASE_URL,
        })
      : null;

  container = {
    products: createProductAdminService({
      repository: createDynamoProductAdminRepository(),
      isAllowedImageUrl: (url) =>
        images ? images.isAllowedImageUrl(url) : isProductImageReference(url, undefined),
    }),
    images,
  };

  return container;
}

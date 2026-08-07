import "server-only";

import {
  createInquiryService,
  type InquiryService,
} from "@/features/inquiry/services/inquiry.service";
import { createOrderRepository } from "@/features/inquiry/services/order.repository";
import { createRateLimitRepository } from "@/features/inquiry/services/rate-limit.repository";
import { createRateLimitService } from "@/features/inquiry/services/rate-limit.service";
import { createProductRepository } from "@/features/products/services/product.repository";
import {
  createProductService,
  type ProductService,
} from "@/features/products/services/product.service";
import { createEmailService } from "@/services/email.service";
import { createNotificationRepository } from "@/services/notification.repository";
import { createNotificationService } from "@/services/notification.service";

/**
 * The composition root.
 *
 * The single place that decides which repository each service receives and which
 * Supabase key that repository holds. Services take their dependencies as
 * arguments rather than importing them, which is what makes them testable
 * without mocking module resolution.
 *
 * Server-only: importing this from a Client Component is a build error, not a
 * leaked service-role key.
 */

export interface Container {
  products: ProductService;
  inquiries: InquiryService;
}

let container: Container | undefined;

/**
 * Built once per function instance and reused. Nothing here holds per-request
 * state, and under Fluid Compute one instance serves many concurrent requests —
 * rebuilding per request would waste the Supabase connection pool for no gain.
 *
 * Note that the write-path repositories resolve their Supabase client lazily, inside
 * each method. That is what lets this container be built on a read-only page in a
 * development environment with no service-role key: constructing the inquiry service
 * touches no credential, so only an actual submission can fail on a missing one.
 */
export function getContainer(): Container {
  container ??= buildContainer();
  return container;
}

function buildContainer(): Container {
  const productRepository = createProductRepository();

  const notifications = createNotificationService({
    email: createEmailService(),
    repository: createNotificationRepository(),
    // WhatsApp arrives in Phase 6. Until then the channel records `skipped`, which
    // is a first-class outcome rather than a failure (ADR-007).
    whatsApp: undefined,
  });

  return {
    products: createProductService({ repository: productRepository }),

    inquiries: createInquiryService({
      orders: createOrderRepository(),
      // The catalog read is the price authority, so the inquiry service reads it
      // through the same repository the catalog pages use — one source of prices.
      products: productRepository,
      rateLimit: createRateLimitService({ repository: createRateLimitRepository() }),
      notifications,
    }),
  };
}

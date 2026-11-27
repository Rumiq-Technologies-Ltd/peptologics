import "server-only";

import {
  createContactService,
  type ContactService,
} from "@/features/contact/services/contact.service";
import {
  createInquiryService,
  type InquiryService,
} from "@/features/inquiry/services/inquiry.service";
import { createOrderRepository } from "@/features/inquiry/services/order.repository";
import { createDynamoOrderRepository } from "@/features/inquiry/services/order.repository.dynamodb";
import { createRateLimitRepository } from "@/features/inquiry/services/rate-limit.repository";
import { createDynamoRateLimitRepository } from "@/features/inquiry/services/rate-limit.repository.dynamodb";
import { createRateLimitService } from "@/features/inquiry/services/rate-limit.service";
import { createProductRepository } from "@/features/products/services/product.repository";
import { createDynamoProductRepository } from "@/features/products/services/product.repository.dynamodb";
import {
  createProductService,
  type ProductService,
} from "@/features/products/services/product.service";
import { NOTIFICATION_RETRY_ATTEMPTS } from "@/constants/business";
import { parseRecipients, sendEmail } from "@/lib/email";
import { customerConfirmationFrom, env, isEmailConfigured } from "@/lib/env";
import { withRetry } from "@/lib/resilience";
import { createEmailService } from "@/services/email.service";
import { createNotificationRepository } from "@/services/notification.repository";
import { createDynamoNotificationRepository } from "@/services/notification.repository.dynamodb";
import { createNotificationService } from "@/services/notification.service";

/**
 * The composition root.
 *
 * The single place that decides which repository each service receives: the Supabase
 * ones or the DynamoDB ones, chosen by `INQUIRY_DATA_STORE` (ADR-035). Services take their dependencies as
 * arguments rather than importing them, which is what makes them testable
 * without mocking module resolution.
 *
 * Server-only: importing this from a Client Component is a build error, not a
 * leaked service-role key.
 */

export interface Container {
  products: ProductService;
  inquiries: InquiryService;
  contact: ContactService;
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

/**
 * The four repositories for the configured data store. Unset means Supabase, so the
 * DynamoDB code is inert until the switch is flipped. The Supabase set is deleted in a
 * later PR, after the two-week fallback period (D7).
 */
function createRepositories() {
  if (env.INQUIRY_DATA_STORE === "dynamodb") {
    return {
      products: createDynamoProductRepository(),
      orders: createDynamoOrderRepository(),
      rateLimit: createDynamoRateLimitRepository(),
      notifications: createDynamoNotificationRepository(),
    };
  }

  return {
    products: createProductRepository(),
    orders: createOrderRepository(),
    rateLimit: createRateLimitRepository(),
    notifications: createNotificationRepository(),
  };
}

function buildContainer(): Container {
  const repositories = createRepositories();
  const productRepository = repositories.products;

  const rateLimit = createRateLimitService({ repository: repositories.rateLimit });

  const notifications = createNotificationService({
    email: createEmailService(),
    repository: repositories.notifications,
  });

  return {
    products: createProductService({ repository: productRepository }),

    inquiries: createInquiryService({
      orders: repositories.orders,
      // The catalog read is the price authority, so the inquiry service reads it
      // through the same repository the catalog pages use — one source of prices.
      products: productRepository,
      rateLimit,
      notifications,
    }),

    // Email only, nothing stored (D33). Shares the transport, retry budget and rate-limit
    // repository with the inquiry flow, so there is one pipeline, not two.
    contact: createContactService({
      rateLimit,
      sendMessage: (message) =>
        withRetry(() => sendEmail(message), {
          attempts: NOTIFICATION_RETRY_ATTEMPTS,
          operationName: "email.sendContact",
        }),
      config: {
        configured: isEmailConfigured,
        companyFrom: env.INQUIRY_NOTIFICATION_FROM ?? "",
        companyTo: parseRecipients(env.INQUIRY_NOTIFICATION_TO ?? ""),
        visitorFrom: customerConfirmationFrom,
      },
    }),
  };
}

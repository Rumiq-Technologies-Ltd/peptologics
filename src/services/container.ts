import "server-only";

import { createProductRepository } from "@/features/products/services/product.repository";
import {
  createProductService,
  type ProductService,
} from "@/features/products/services/product.service";

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
}

let container: Container | undefined;

/**
 * Built once per function instance and reused. Nothing here holds per-request
 * state, and under Fluid Compute one instance serves many concurrent requests —
 * rebuilding per request would waste the Supabase connection pool for no gain.
 */
export function getContainer(): Container {
  container ??= {
    products: createProductService({ repository: createProductRepository() }),
  };

  return container;
}

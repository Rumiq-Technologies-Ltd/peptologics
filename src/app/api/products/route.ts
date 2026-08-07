import type { NextRequest } from "next/server";

import { getContainer } from "@/services/container";
import { jsonFail, jsonFromServiceFailure, jsonOk } from "@/lib/http/responses";
import { logger } from "@/lib/logger";
import { GENERIC_ERROR_MESSAGE } from "@/lib/errors";

/**
 * GET /api/products — the active catalog.
 *
 * Thin by design: read the query, call the service, map the result. No business
 * logic and no database access live here.
 *
 * The site itself does not use this endpoint — pages read through the service
 * layer directly in Server Components, which avoids an HTTP hop to ourselves.
 * It exists for monitoring and for any future external consumer.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { products } = getContainer();
  const params = request.nextUrl.searchParams;

  try {
    const result = await products.listActive({
      sort: products.resolveSort(params.get("sort") ?? undefined),
      search: params.get("search") ?? undefined,
    });

    if (!result.success) {
      return jsonFromServiceFailure(result);
    }

    return jsonOk(result.data, `${result.data.length} products available.`);
  } catch (error) {
    // The service already handles its own failures, so reaching here means
    // something unanticipated. Log the detail, return nothing revealing.
    logger.error("api_products_unhandled", { error });
    return jsonFail(GENERIC_ERROR_MESSAGE, { status: 500, code: "UNEXPECTED" });
  }
}

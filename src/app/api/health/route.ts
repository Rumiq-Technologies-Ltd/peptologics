import { getContainer } from "@/services/container";
import { jsonFail, jsonOk } from "@/lib/http/responses";
import { isWriteClientAvailable } from "@/lib/supabase/client.server";
import { isEmailConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * GET /api/health — liveness plus a real dependency check.
 *
 * Reports whether the application is running *and* whether the database is
 * actually reachable, because a process that is up but cannot read the catalog is
 * not healthy in any useful sense.
 *
 * Deliberately reveals no detail: no connection strings, no error messages, no
 * versions. A booleans-and-counts response is enough for a monitor and useless to
 * anyone probing the service.
 */
export async function GET(): Promise<Response> {
  const startedAt = performance.now();

  try {
    // A cheap real query rather than a ping — this exercises the key, RLS, and
    // the connection in one go, which is what actually breaks in production.
    const result = await getContainer().products.listActive({ limit: 1 });
    const latencyMs = Math.round(performance.now() - startedAt);

    if (!result.success) {
      logger.warn("health_database_unreachable", { code: result.code });
      return jsonFail("Service is degraded.", { status: 503, code: "DEGRADED" });
    }

    return jsonOk(
      {
        status: "ok",
        database: "reachable",
        latencyMs,
        // Configuration surface, not secrets: which optional channels are wired
        // up. Useful for confirming a deployment picked up its env vars.
        channels: {
          email: isEmailConfigured ? "configured" : "not_configured",
          inquiryWrites: isWriteClientAvailable() ? "available" : "unavailable",
        },
      },
      "Service is healthy.",
    );
  } catch (error) {
    logger.error("health_check_failed", { error });
    return jsonFail("Service is unavailable.", { status: 503, code: "UNAVAILABLE" });
  }
}

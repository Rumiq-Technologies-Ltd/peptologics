import { revalidatePath } from "next/cache";
import { timingSafeEqual } from "node:crypto";

import { ROUTES } from "@/constants/routes";
import { env } from "@/lib/env";
import { jsonFail, jsonOk } from "@/lib/http/responses";
import { logger } from "@/lib/logger";
import { isValidSlug } from "@/utils/slugify";

/**
 * POST /api/revalidate — purge the catalog cache after a price change.
 *
 * The catalog is statically rendered with a one-hour ISR window, which is the right
 * default but the wrong latency for a correction: nobody wants a wrong price live for
 * up to an hour. This endpoint makes the refresh immediate.
 *
 * Authorised by a bearer secret, compared in constant time. A plain `===` on a secret
 * leaks its length and prefix through timing, which is a real if unglamorous attack on
 * an endpoint anyone can call repeatedly.
 *
 * `revalidatePath` behaves identically under Cache Components, so this survives a
 * future Phase 10 migration untouched (ADR-008).
 */

/** Body: `{ "slug": "retatrutide-10mg" }` to target one product, or omit for the catalog. */
interface RevalidateBody {
  slug?: unknown;
}

/** Constant-time comparison that does not leak length through an early return. */
function isAuthorised(header: string | null): boolean {
  const secret = env.REVALIDATE_SECRET;

  // No secret configured means the endpoint is closed, not open. Failing the other way
  // would leave a cache-purge endpoint unauthenticated on any deployment that forgot it.
  if (!secret) return false;
  if (!header?.startsWith("Bearer ")) return false;

  const provided = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);

  // timingSafeEqual throws on a length mismatch, so the lengths are compared first —
  // which does leak the secret's length, and is the accepted cost of the primitive.
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorised(request.headers.get("authorization"))) {
    logger.warn("revalidate_unauthorised");
    return jsonFail("Not authorised.", { status: 401, code: "UNAUTHORISED" });
  }

  let body: RevalidateBody = {};

  try {
    // An empty body is valid and means "the whole catalog", so a parse failure is not
    // an error in itself.
    body = (await request.json()) as RevalidateBody;
  } catch {
    body = {};
  }

  const revalidated: string[] = [];

  if (typeof body.slug === "string") {
    if (!isValidSlug(body.slug)) {
      return jsonFail("That product reference is not valid.", {
        status: 422,
        code: "VALIDATION_FAILED",
      });
    }

    revalidatePath(ROUTES.product(body.slug));
    revalidated.push(ROUTES.product(body.slug));
  }

  /*
   * Always purge the list pages as well. A price change shows on the detail page and
   * in the catalog row and the home page's featured strip, and refreshing one without
   * the others is how a site ends up quoting two different prices for one product.
   */
  for (const path of [ROUTES.home, ROUTES.products]) {
    revalidatePath(path);
    revalidated.push(path);
  }

  logger.info("revalidated", { paths: revalidated });

  return jsonOk({ revalidated }, "Cache purged.");
}

export async function GET(): Promise<Response> {
  // Explicit, so a browser visit gets a clear answer rather than Next's default 405
  // with an empty body.
  return jsonFail("Use POST with a bearer token.", {
    status: 405,
    code: "METHOD_NOT_ALLOWED",
  });
}

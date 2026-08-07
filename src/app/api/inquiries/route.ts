import { z } from "zod";

import { MESSAGES } from "@/constants/messages";
import { GENERIC_ERROR_MESSAGE } from "@/lib/errors";
import { jsonCreated, jsonFail, jsonFromServiceFailure } from "@/lib/http/responses";
import { logger } from "@/lib/logger";
import { getClientIp, hashIp, isSameOrigin } from "@/lib/security/request";
import { inquirySchema, toFieldErrors } from "@/lib/validations/inquiry.schema";
import { getContainer } from "@/services/container";

/**
 * POST /api/inquiries — create an inquiry.
 *
 * Thin, like every handler here: check the request is ours, validate it, hand it to
 * the service, map the result. Every business rule — spam filtering, rate limiting,
 * pricing, persistence, notification — lives in `InquiryService`.
 *
 * A Route Handler rather than a Server Action, deliberately (ADR-006). This endpoint
 * needs an `Idempotency-Key` header, a `Retry-After` on 429, real status codes, and a
 * documented contract; Server Actions give none of those without fighting them.
 */

/** The header carries the key, so a retry of the same request replays rather than duplicates. */
const idempotencyKeySchema = z.uuid();

export async function POST(request: Request): Promise<Response> {
  // Cheap defence in depth. Our form is the only legitimate caller, so an Origin
  // that is not ours is either misconfigured or hostile.
  if (!isSameOrigin(request)) {
    logger.warn("inquiry_cross_origin_rejected");
    return jsonFail("This request was not accepted.", { status: 403, code: "FORBIDDEN" });
  }

  const idempotencyKey = idempotencyKeySchema.safeParse(request.headers.get("idempotency-key"));

  if (!idempotencyKey.success) {
    return jsonFail(
      "This submission is missing its idempotency key. Please reload and try again.",
      {
        status: 400,
        code: "VALIDATION_FAILED",
      },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonFail("We could not read that submission. Please reload and try again.", {
      status: 400,
      code: "VALIDATION_FAILED",
    });
  }

  /*
   * Validated before the rate limiter runs, which is intentional: parsing costs no
   * database round trip, so a malformed flood is refused without touching Postgres.
   * The counter exists to protect the inbox and the write path, and neither is
   * reachable from here.
   */
  const parsed = inquirySchema.safeParse(body);

  if (!parsed.success) {
    return jsonFail(MESSAGES.inquiry.validationFailed, {
      status: 422,
      code: "VALIDATION_FAILED",
      errors: Object.entries(toFieldErrors(parsed.error)).flatMap(([field, messages]) =>
        messages.map((message) => ({ field, message })),
      ),
    });
  }

  try {
    const result = await getContainer().inquiries.submit(parsed.data, {
      idempotencyKey: idempotencyKey.data,
      // Hashed with a server-side salt: the limiter needs a stable key, not an
      // identity, and a raw address would be PII we have no reason to hold.
      clientKey: hashIp(getClientIp(request)),
    });

    if (!result.success) {
      return jsonFromServiceFailure(result);
    }

    /*
     * 201 for a replay and for a suppressed submission too. The service has already
     * decided what actually happened; the wire response deliberately does not
     * distinguish the three, so a bot cannot learn which filter caught it and a
     * double-click cannot alarm a customer.
     */
    return jsonCreated(result.data, MESSAGES.inquiry.success);
  } catch (error) {
    // The service returns its failures, so arriving here means something
    // unanticipated. Log the detail; reveal none of it.
    logger.error("api_inquiries_unhandled", { error });
    return jsonFail(GENERIC_ERROR_MESSAGE, { status: 500, code: "UNEXPECTED" });
  }
}

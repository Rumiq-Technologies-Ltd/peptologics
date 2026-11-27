import { MESSAGES } from "@/constants/messages";
import { GENERIC_ERROR_MESSAGE } from "@/lib/errors";
import { jsonCreated, jsonFail, jsonFromServiceFailure } from "@/lib/http/responses";
import { logger } from "@/lib/logger";
import { getClientIp } from "@/lib/security/clientIp";
import { hashIp, isSameOrigin } from "@/lib/security/request";
import { contactRequestSchema } from "@/lib/validations/contact.schema";
import { toFieldErrors } from "@/lib/validations/inquiry.schema";
import { getContainer } from "@/services/container";

/**
 * POST /api/contact: send a message from the contact form.
 *
 * Thin, like every handler here: check the request is ours, validate it, hand it to
 * `ContactService`, map the result. The spam filters, the rate limit and both emails live
 * in the service. Nothing is stored (D33).
 *
 * A Route Handler rather than a Server Action for the same reason as `/api/inquiries`
 * (ADR-006): it needs real status codes and a `Retry-After` on 429.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    logger.warn("contact_cross_origin_rejected");
    return jsonFail("This request was not accepted.", { status: 403, code: "FORBIDDEN" });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonFail("We could not read that message. Please reload and try again.", {
      status: 400,
      code: "VALIDATION_FAILED",
    });
  }

  const parsed = contactRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonFail(MESSAGES.contact.validationFailed, {
      status: 422,
      code: "VALIDATION_FAILED",
      errors: Object.entries(toFieldErrors(parsed.error)).flatMap(([field, messages]) =>
        messages.map((message) => ({ field, message })),
      ),
    });
  }

  try {
    const result = await getContainer().contact.submit(parsed.data, {
      // Hashed with a server-side salt: the limiter needs a stable key, not an identity.
      clientKey: hashIp(getClientIp(request)),
    });

    if (!result.success) {
      return jsonFromServiceFailure(result);
    }

    // 201 for a suppressed submission too: the wire response must not reveal which filter
    // caught a bot.
    return jsonCreated(result.data, MESSAGES.contact.success);
  } catch (error) {
    logger.error("api_contact_unhandled", { error });
    return jsonFail(GENERIC_ERROR_MESSAGE, { status: 500, code: "UNEXPECTED" });
  }
}

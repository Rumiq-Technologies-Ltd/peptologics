import { logger } from "@/lib/logger";
import { isSameOrigin } from "@/lib/security/request";
import { webVitalSchema } from "@/lib/validations/webVitals.schema";

/**
 * POST /api/vitals — record one real-user speed measurement (ADR-031).
 *
 * The browser sends LCP, INP, CLS, FCP and TTFB as each becomes final. Each one is
 * written as a structured `web_vital` log line, which the host's log search can
 * filter and chart — on Vercel or Amplify alike, with no third-party script and no
 * change to the CSP.
 *
 * Always answers 204 with no body, valid or not. The sender is `sendBeacon`, which
 * never reads the response, so detail here would only help someone probing it.
 *
 * Not rate limited, on purpose. The worst a flood can do is add log lines; a limiter
 * would cost a database round trip on every beacon from every real visitor to defend
 * against that.
 */

/** A real report is ~200 bytes. Anything much larger is not one. */
const MAX_BODY_BYTES = 2_048;

const NO_CONTENT = (): Response => new Response(null, { status: 204 });

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return NO_CONTENT();

  let body: unknown;

  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return NO_CONTENT();
    body = JSON.parse(text);
  } catch {
    return NO_CONTENT();
  }

  const parsed = webVitalSchema.safeParse(body);

  if (!parsed.success) {
    logger.debug("web_vital_rejected");
    return NO_CONTENT();
  }

  const { name, value, rating, id, navigationType, pathname } = parsed.data;

  logger.info("web_vital", {
    metric: name,
    // CLS is a small decimal; every other metric is milliseconds.
    value: name === "CLS" ? Math.round(value * 1000) / 1000 : Math.round(value),
    rating,
    pageLoadId: id,
    navigationType,
    pathname,
  });

  return NO_CONTENT();
}

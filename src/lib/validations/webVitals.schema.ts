import { z } from "zod";

/**
 * The real-user speed report, shared by the browser reporter and `POST /api/vitals`.
 *
 * Deliberately carries no identity: no user agent, no IP, no query string. The page
 * path is enough to say *where* the site is slow, and anything more would be personal
 * data collected for no purpose (CLAUDE.md, Analytics).
 *
 * Bounds are generous rather than tight. A value outside them is not a slow page — it
 * is a forged or broken beacon, and refusing it keeps junk out of the logs.
 */

export const WEB_VITAL_NAMES = ["CLS", "FCP", "INP", "LCP", "TTFB"] as const;

/** One minute. No honest timing metric on a page this size gets anywhere near it. */
const MAX_TIMING_MS = 60_000;

/** CLS is unitless; 0.25 is already "poor", so anything past this is not a real layout. */
const MAX_CLS = 10;

export const webVitalSchema = z
  .object({
    name: z.enum(WEB_VITAL_NAMES),
    value: z.number().finite().min(0),
    rating: z.enum(["good", "needs-improvement", "poor"]),
    // web-vitals' own per-page-load ID, e.g. "v5-1730000000000-1234567890123".
    id: z.string().min(1).max(64),
    navigationType: z.string().max(32).optional(),
    // Path only. The reporter strips the query string before sending.
    pathname: z.string().startsWith("/").max(200),
  })
  .refine((vital) => vital.value <= (vital.name === "CLS" ? MAX_CLS : MAX_TIMING_MS), {
    error: "Value is outside any real measurement.",
    path: ["value"],
  });

export type WebVitalReport = z.infer<typeof webVitalSchema>;

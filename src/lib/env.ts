import "server-only";

import { z } from "zod";

/**
 * Server-side environment contract.
 *
 * `server-only` makes an accidental import from a Client Component a build
 * error rather than a leaked service-role key. Every secret in the application
 * is read here and nowhere else.
 *
 * Optional-by-design: the Resend credentials are `.optional()` so the inquiry
 * flow, the build, and local development all work before that account exists.
 * Missing credentials degrade the email channel to `skipped`; they never throw
 * and never block an order from being saved.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // --- Site -----------------------------------------------------------------
  /** Absolute origin, no trailing slash. Drives metadataBase and canonical URLs. */
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),

  // --- Supabase -------------------------------------------------------------
  SUPABASE_URL: z.url(),
  /**
   * Deliberately NOT prefixed NEXT_PUBLIC_. The browser never talks to Supabase;
   * every query runs server-side, so there is no reason to ship this key.
   */
  SUPABASE_ANON_KEY: z.string().min(1),
  /**
   * Bypasses RLS. Write path only. Never reaches a repository that reads.
   *
   * Optional in development so the read-only catalog can be run without holding
   * the most dangerous secret in the project; a cross-field check below makes it
   * mandatory in production, so a deploy cannot succeed without it.
   */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // --- Email (Resend) -------------------------------------------------------
  RESEND_API_KEY: z.string().min(1).optional(),
  /** Must be on a Resend-verified sending domain. */
  INQUIRY_NOTIFICATION_FROM: z.string().min(1).optional(),
  /** Comma-separated list of internal recipients. */
  INQUIRY_NOTIFICATION_TO: z.string().min(1).optional(),

  // --- Operations -----------------------------------------------------------
  /** Bearer secret for POST /api/revalidate. */
  REVALIDATE_SECRET: z.string().min(16).optional(),
  /** Salt for hashing IP addresses before they touch the rate-limit table. */
  RATE_LIMIT_SALT: z.string().min(16).default("peptologics-dev-salt-change-me"),
});

/**
 * Cross-field rules that only apply to a real deployment.
 *
 * Keeping these separate from the field definitions is what lets development run
 * the read-only catalog with nothing but a Supabase URL and publishable key,
 * while still making a production deploy fail fast on a missing secret.
 */
const serverEnvSchemaWithProductionRules = serverEnvSchema
  .refine((value) => value.NODE_ENV !== "production" || Boolean(value.SUPABASE_SERVICE_ROLE_KEY), {
    error: "Required in production — the inquiry write path cannot run without it.",
    path: ["SUPABASE_SERVICE_ROLE_KEY"],
  })
  .refine(
    (value) =>
      value.NODE_ENV !== "production" || value.RATE_LIMIT_SALT !== "peptologics-dev-salt-change-me",
    {
      error: "Must be set to a real secret in production — the default salt is public.",
      path: ["RATE_LIMIT_SALT"],
    },
  );

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Drops empty-string values so `.optional()` and `.default()` behave as written.
 *
 * A variable declared but left blank in a `.env` file — `RESEND_API_KEY=` — is
 * read as `""`, not `undefined`. Zod treats that as a value present and failing
 * `.min(1)`, so a perfectly ordinary "not configured yet" env file would refuse
 * to boot. Normalising here is what makes a blank line in `.env.local` mean
 * "unset", which is what everyone writing one intends.
 */
function withoutBlankValues(source: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const normalised: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(source)) {
    normalised[key] = typeof value === "string" && value.trim() === "" ? undefined : value;
  }

  return normalised;
}

function loadServerEnv(): ServerEnv {
  const parsed = serverEnvSchemaWithProductionRules.safeParse(withoutBlankValues(process.env));

  if (!parsed.success) {
    // Variable names and messages only. Printing the offending values here would
    // put secrets into build logs, which are far more widely readable than the
    // environment itself.
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");

    throw new Error(
      `Invalid or missing environment variables — ${problems}. See .env.example for the full contract.`,
    );
  }

  return parsed.data;
}

export const env: ServerEnv = loadServerEnv();

/** True only when every credential the Resend adapter needs is present. */
export const isEmailConfigured: boolean = Boolean(
  env.RESEND_API_KEY && env.INQUIRY_NOTIFICATION_FROM && env.INQUIRY_NOTIFICATION_TO,
);

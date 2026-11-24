import "server-only";

import { z } from "zod";

/**
 * Server-side environment contract.
 *
 * `server-only` makes an accidental import from a Client Component a build
 * error rather than a leaked service-role key. Every secret in the application
 * is read here and nowhere else.
 *
 * Optional-by-design: the email credentials are `.optional()` so the inquiry
 * flow, the build, and local development all work before that account exists.
 * Missing credentials degrade the email channel to `skipped`; they never throw
 * and never block an order from being saved.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /**
   * Which deployment this build is for. Amplify sets nothing like this for us, so we set
   * it ourselves per Amplify branch: `main` is `production`, `staging` is `staging`.
   * Unset means a developer's own machine.
   *
   * `NODE_ENV` cannot tell these apart: a staging build also runs with
   * `NODE_ENV=production`, so a rule keyed on it would fail every staging deploy.
   * Every launch-critical check below is keyed on this instead (ADR-032).
   */
  APP_ENV: z.enum(["development", "staging", "production"]).optional(),

  // --- Site -----------------------------------------------------------------
  /** Absolute origin, no trailing slash. Drives metadataBase and canonical URLs. */
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),

  // --- Data store (Supabase or DynamoDB, ADR-035) ---------------------------
  /**
   * Which database holds products, inquiries, notifications and rate limits. Unset means
   * `supabase`, so shipping the DynamoDB code changes nothing until this is flipped.
   * Rolling back is setting it back and rebuilding.
   */
  INQUIRY_DATA_STORE: z.enum(["supabase", "dynamodb"]).default("supabase"),
  /**
   * The DynamoDB table for this environment: `peptologics-dev` (developer machines only),
   * `peptologics-staging` or `peptologics-prod`. Required when the store is `dynamodb`.
   * Credentials are never set here: locally `AWS_PROFILE`, on Amplify the app's IAM role.
   */
  DYNAMODB_TABLE_NAME: z.string().min(1).optional(),

  // --- Supabase (required only while INQUIRY_DATA_STORE=supabase) -----------
  SUPABASE_URL: z.url().optional(),
  /**
   * Deliberately NOT prefixed NEXT_PUBLIC_. The browser never talks to Supabase;
   * every query runs server-side, so there is no reason to ship this key.
   */
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  /**
   * Bypasses RLS. Write path only. Never reaches a repository that reads.
   *
   * Optional in development so the read-only catalog can be run without holding
   * the most dangerous secret in the project; a cross-field check below makes it
   * mandatory in production, so a deploy cannot succeed without it.
   */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // --- Email (Resend or SES, ADR-037) ---------------------------------------
  /** Which provider sends inquiry email. Unset means `resend`; flipping it is the rollback. */
  INQUIRY_EMAIL_PROVIDER: z.enum(["resend", "ses"]).default("resend"),
  /** SES configuration set; tracks bounces and complaints. Required in production for `ses`. */
  INQUIRY_SES_CONFIGURATION_SET: z.string().min(1).optional(),
  /** Required only when the provider is `resend`. Retired once SES is proven. */
  RESEND_API_KEY: z.string().min(1).optional(),
  /** Must be on a domain verified with the active provider. */
  INQUIRY_NOTIFICATION_FROM: z.string().min(1).optional(),
  /** Comma-separated list of internal recipients. */
  INQUIRY_NOTIFICATION_TO: z.string().min(1).optional(),
  /**
   * Sender for the customer confirmation. Falls back to `INQUIRY_NOTIFICATION_FROM`.
   *
   * Separate from the internal sender because the two are read by different people. The
   * internal notification can come from anything that delivers; the confirmation is the
   * customer's only written record of the exchange and should come from an address they
   * would recognise and can reply to — `hello@peptologics.com` rather than a no-reply.
   *
   * Optional, and the fallback is what keeps it optional: an environment that has not set
   * it still sends confirmations, from the same address as everything else, rather than
   * silently skipping them.
   */
  CUSTOMER_CONFIRMATION_FROM: z.string().min(1).optional(),

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
export const serverEnvSchemaWithProductionRules = serverEnvSchema
  .refine((value) => value.INQUIRY_DATA_STORE !== "supabase" || Boolean(value.SUPABASE_URL), {
    error: "Required while INQUIRY_DATA_STORE is supabase (the default).",
    path: ["SUPABASE_URL"],
  })
  .refine((value) => value.INQUIRY_DATA_STORE !== "supabase" || Boolean(value.SUPABASE_ANON_KEY), {
    error: "Required while INQUIRY_DATA_STORE is supabase (the default).",
    path: ["SUPABASE_ANON_KEY"],
  })
  .refine(
    (value) => value.INQUIRY_DATA_STORE !== "dynamodb" || Boolean(value.DYNAMODB_TABLE_NAME),
    {
      error: "Required when INQUIRY_DATA_STORE is dynamodb.",
      path: ["DYNAMODB_TABLE_NAME"],
    },
  )
  .refine(
    (value) =>
      value.INQUIRY_DATA_STORE !== "supabase" ||
      value.NODE_ENV !== "production" ||
      Boolean(value.SUPABASE_SERVICE_ROLE_KEY),
    {
      error: "Required in production — the inquiry write path cannot run without it.",
      path: ["SUPABASE_SERVICE_ROLE_KEY"],
    },
  )
  .refine(
    (value) =>
      value.NODE_ENV !== "production" || value.RATE_LIMIT_SALT !== "peptologics-dev-salt-change-me",
    {
      error: "Must be set to a real secret in production — the default salt is public.",
      path: ["RATE_LIMIT_SALT"],
    },
  )
  /*
   * The two rules below exist because both failures already happened on the live site,
   * silently, and neither was visible from inside the application (ADR-025).
   *
   * They are keyed on APP_ENV, not NODE_ENV: a staging build also runs with
   * NODE_ENV=production, and neither rule should apply to staging.
   */
  .refine(
    (value) => {
      if (value.APP_ENV !== "production") return true;

      const host = new URL(value.NEXT_PUBLIC_SITE_URL).hostname;
      return host !== "localhost" && !host.endsWith(".amplifyapp.com");
    },
    {
      error:
        "Must be the real customer-facing domain in production. Left unset or pointed at the " +
        "*.amplifyapp.com URL, every canonical link, Open Graph URL, sitemap entry and JSON-LD @id " +
        "names a host that is not the one being served — which tells search engines the site " +
        "lives somewhere else.",
      path: ["NEXT_PUBLIC_SITE_URL"],
    },
  )
  .refine(
    (value) => {
      if (value.APP_ENV !== "production") return true;

      return Boolean(
        value.INQUIRY_NOTIFICATION_FROM &&
        value.INQUIRY_NOTIFICATION_TO &&
        (value.INQUIRY_EMAIL_PROVIDER === "ses" || value.RESEND_API_KEY),
      );
    },
    {
      error:
        "INQUIRY_NOTIFICATION_FROM and INQUIRY_NOTIFICATION_TO are required in production, plus " +
        "RESEND_API_KEY when INQUIRY_EMAIL_PROVIDER is resend (the default). Email is the only " +
        "notification channel (ADR-023): without them an inquiry still saves and still returns a " +
        "cheerful confirmation, but nobody is ever told about the lead.",
      path: ["INQUIRY_NOTIFICATION_FROM"],
    },
  )
  .refine(
    (value) =>
      value.APP_ENV !== "production" ||
      value.INQUIRY_EMAIL_PROVIDER !== "ses" ||
      Boolean(value.INQUIRY_SES_CONFIGURATION_SET),
    {
      error:
        "INQUIRY_SES_CONFIGURATION_SET is required in production when INQUIRY_EMAIL_PROVIDER is " +
        "ses: without it bounces and complaints are not tracked.",
      path: ["INQUIRY_SES_CONFIGURATION_SET"],
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

/** True only when everything the active email provider needs is present. */
export const isEmailConfigured: boolean = Boolean(
  env.INQUIRY_NOTIFICATION_FROM &&
  env.INQUIRY_NOTIFICATION_TO &&
  (env.INQUIRY_EMAIL_PROVIDER === "ses" || env.RESEND_API_KEY),
);

/**
 * The address customer confirmations are sent from.
 *
 * Resolved once here rather than at each call site, so the fallback rule exists in exactly
 * one place. Empty string when email is not configured at all, which the channel checks
 * for before it ever reaches this value.
 */
export const customerConfirmationFrom: string =
  env.CUSTOMER_CONFIRMATION_FROM ?? env.INQUIRY_NOTIFICATION_FROM ?? "";

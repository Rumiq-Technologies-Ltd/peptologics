import "server-only";

import { z } from "zod";

/**
 * Server-side environment contract.
 *
 * `server-only` makes an accidental import from a Client Component a build
 * error rather than a leaked service-role key. Every secret in the application
 * is read here and nowhere else.
 *
 * Optional-by-design: Resend and WhatsApp credentials are `.optional()` so the
 * inquiry flow, the build, and local development all work before those accounts
 * exist. Missing credentials degrade a notification channel to `skipped`; they
 * never throw and never block an order from being saved.
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
  /** Bypasses RLS. Write path only. Never reaches a repository that reads. */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // --- Email (Resend) -------------------------------------------------------
  RESEND_API_KEY: z.string().min(1).optional(),
  /** Must be on a Resend-verified sending domain. */
  INQUIRY_NOTIFICATION_FROM: z.string().min(1).optional(),
  /** Comma-separated list of internal recipients. */
  INQUIRY_NOTIFICATION_TO: z.string().min(1).optional(),

  // --- WhatsApp (Meta Cloud API) -------------------------------------------
  WHATSAPP_ENABLED: z.enum(["true", "false"]).default("false"),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1).optional(),
  /** E.164, no '+' — the number that receives inquiry notifications. */
  WHATSAPP_RECIPIENT: z.string().min(1).optional(),
  WHATSAPP_TEMPLATE_NAME: z.string().min(1).optional(),
  WHATSAPP_TEMPLATE_LOCALE: z.string().min(2).default("en"),

  // --- Operations -----------------------------------------------------------
  /** Bearer secret for POST /api/revalidate. */
  REVALIDATE_SECRET: z.string().min(16).optional(),
  /** Salt for hashing IP addresses before they touch the rate-limit table. */
  RATE_LIMIT_SALT: z.string().min(16).default("peptologics-dev-salt-change-me"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function loadServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    // Names only. Printing values here would put secrets in build logs.
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(
      `Invalid or missing environment variables: ${missing}. See .env.example for the full contract.`,
    );
  }

  return parsed.data;
}

export const env: ServerEnv = loadServerEnv();

/** True only when every credential the Resend adapter needs is present. */
export const isEmailConfigured: boolean = Boolean(
  env.RESEND_API_KEY && env.INQUIRY_NOTIFICATION_FROM && env.INQUIRY_NOTIFICATION_TO,
);

/**
 * True only when WhatsApp is both switched on and fully credentialed. The
 * two-part check means a half-configured deployment degrades to `skipped`
 * instead of throwing on every inquiry.
 */
export const isWhatsAppConfigured: boolean =
  env.WHATSAPP_ENABLED === "true" &&
  Boolean(
    env.WHATSAPP_PHONE_NUMBER_ID &&
    env.WHATSAPP_ACCESS_TOKEN &&
    env.WHATSAPP_RECIPIENT &&
    env.WHATSAPP_TEMPLATE_NAME,
  );

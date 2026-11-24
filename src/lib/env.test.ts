import { beforeAll, describe, expect, it, vi } from "vitest";

import type * as EnvModule from "@/lib/env";

/*
 * `@/lib/env` parses process.env when imported, so the minimum it needs is stubbed first.
 * The tests themselves feed the exported schema their own inputs.
 */
let serverEnvSchemaWithProductionRules: typeof EnvModule.serverEnvSchemaWithProductionRules;

beforeAll(async () => {
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_ANON_KEY", "anon");
  ({ serverEnvSchemaWithProductionRules } = await import("@/lib/env"));
  vi.unstubAllEnvs();
});

/**
 * The two launch-critical checks (ADR-025) must fire only for APP_ENV=production: staging
 * and local builds run with a non-production site URL and optional email (ADR-032).
 */

const base = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon",
};

function issuePaths(input: Record<string, string | undefined>): string[] {
  const result = serverEnvSchemaWithProductionRules.safeParse({ ...base, ...input });
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
}

describe("production-only environment rules", () => {
  const badUrl = { NEXT_PUBLIC_SITE_URL: "https://main.d1zqn3kd1eopzq.amplifyapp.com" };

  it("rejects an amplifyapp.com or localhost site URL only when APP_ENV=production", () => {
    expect(issuePaths({ ...badUrl, APP_ENV: "production" })).toContain("NEXT_PUBLIC_SITE_URL");
    expect(
      issuePaths({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000", APP_ENV: "production" }),
    ).toContain("NEXT_PUBLIC_SITE_URL");

    for (const appEnv of [undefined, "development", "staging"]) {
      expect(issuePaths({ ...badUrl, APP_ENV: appEnv })).not.toContain("NEXT_PUBLIC_SITE_URL");
    }
  });

  it("accepts the real domain in production", () => {
    expect(
      issuePaths({ NEXT_PUBLIC_SITE_URL: "https://peptologics.com", APP_ENV: "production" }),
    ).not.toContain("NEXT_PUBLIC_SITE_URL");
  });

  it("requires every email variable only when APP_ENV=production", () => {
    expect(issuePaths({ APP_ENV: "production" })).toContain("RESEND_API_KEY");

    for (const appEnv of [undefined, "development", "staging"]) {
      expect(issuePaths({ APP_ENV: appEnv })).not.toContain("RESEND_API_KEY");
    }
  });

  it("is satisfied when production has every email variable", () => {
    expect(
      issuePaths({
        APP_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://peptologics.com",
        RESEND_API_KEY: "key",
        INQUIRY_NOTIFICATION_FROM: "a@peptologics.com",
        INQUIRY_NOTIFICATION_TO: "b@peptologics.com",
      }),
    ).not.toContain("RESEND_API_KEY");
  });
});

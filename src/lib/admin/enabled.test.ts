import { describe, expect, it } from "vitest";

import { isAdminEnabled, type AdminGateInput } from "@/lib/admin/enabled";

const on: AdminGateInput = {
  APP_ENV: "staging",
  INQUIRY_DATA_STORE: "dynamodb",
  NEXT_PUBLIC_COGNITO_USER_POOL_ID: "us-east-1_AbCdEfGhI",
  NEXT_PUBLIC_COGNITO_CLIENT_ID: "abcdefghij1234567890",
  NEXT_PUBLIC_COGNITO_DOMAIN: "peptologics-staging.auth.us-east-1.amazoncognito.com",
};

describe("isAdminEnabled", () => {
  it("is on for staging and for a developer machine with everything set", () => {
    expect(isAdminEnabled(on)).toBe(true);
    expect(isAdminEnabled({ ...on, APP_ENV: undefined })).toBe(true);
    expect(isAdminEnabled({ ...on, APP_ENV: "development" })).toBe(true);
  });

  it("is off in production even when everything else is set (until Stage 4)", () => {
    expect(isAdminEnabled({ ...on, APP_ENV: "production" })).toBe(false);
  });

  it("is off on Supabase", () => {
    expect(isAdminEnabled({ ...on, INQUIRY_DATA_STORE: "supabase" })).toBe(false);
  });

  it.each([
    "NEXT_PUBLIC_COGNITO_USER_POOL_ID",
    "NEXT_PUBLIC_COGNITO_CLIENT_ID",
    "NEXT_PUBLIC_COGNITO_DOMAIN",
  ] as const)("is off when %s is missing", (name) => {
    expect(isAdminEnabled({ ...on, [name]: undefined })).toBe(false);
  });
});

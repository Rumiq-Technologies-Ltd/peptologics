/**
 * Whether the admin is switched on for this deployment (ADR-038).
 *
 * Pure, and free of the env module, so the rule can be unit-tested on its own. There is
 * deliberately no `ADMIN_ENABLED` variable: Amplify only passes a fixed list of variable
 * prefixes to the server, and the rule is stricter than a flag anyway. All of these must hold:
 *
 * - the three Cognito settings are present (an unconfigured deployment has nothing to sign in to);
 * - the data store is DynamoDB (the admin's audit log and every later phase live there);
 * - this is not production. **Stage 4 removes this last line in its own PR**, once the
 *   production pool and table exist. Until then production answers `/admin` with a 404 twice
 *   over: no pool is configured there, and this refuses even if someone sets one.
 */
export interface AdminGateInput {
  APP_ENV?: "development" | "staging" | "production";
  INQUIRY_DATA_STORE: "supabase" | "dynamodb";
  NEXT_PUBLIC_COGNITO_USER_POOL_ID?: string;
  NEXT_PUBLIC_COGNITO_CLIENT_ID?: string;
  NEXT_PUBLIC_COGNITO_DOMAIN?: string;
}

export function isAdminEnabled(input: AdminGateInput): boolean {
  return (
    Boolean(input.NEXT_PUBLIC_COGNITO_USER_POOL_ID) &&
    Boolean(input.NEXT_PUBLIC_COGNITO_CLIENT_ID) &&
    Boolean(input.NEXT_PUBLIC_COGNITO_DOMAIN) &&
    input.INQUIRY_DATA_STORE === "dynamodb" &&
    input.APP_ENV !== "production"
  );
}

import "server-only";

import { createServerRunner } from "@aws-amplify/adapter-nextjs";

import { env } from "@/lib/env";

import { ADMIN_PATHS } from "./paths";

/**
 * The Cognito connection (ADR-038).
 *
 * Built lazily so a deployment with the admin off (production today) never constructs it.
 * Nothing here is secret: the app client is public and the code flow is protected by PKCE.
 */

/**
 * The adapter reads its own origin from `AMPLIFY_APP_ORIGIN`, a name Amplify's build spec
 * does not pass to the server. It is the same value as the site URL, so it is set from that
 * here, before the runner is created, rather than adding a variable prefix.
 */
function siteOrigin(): string {
  return new URL(env.NEXT_PUBLIC_SITE_URL).origin;
}

export function cognitoSettings(): {
  userPoolId: string;
  clientId: string;
  domain: string;
} {
  const userPoolId = env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  const clientId = env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  const domain = env.NEXT_PUBLIC_COGNITO_DOMAIN;

  if (!userPoolId || !clientId || !domain) {
    throw new Error("Cognito is not configured; the admin must be disabled.");
  }

  return { userPoolId, clientId, domain };
}

function buildRunner() {
  const { userPoolId, clientId, domain } = cognitoSettings();
  const origin = siteOrigin();

  process.env.AMPLIFY_APP_ORIGIN = origin;

  return createServerRunner({
    config: {
      Auth: {
        Cognito: {
          userPoolId,
          userPoolClientId: clientId,
          loginWith: {
            oauth: {
              domain,
              scopes: ["openid", "email"],
              redirectSignIn: [`${origin}${ADMIN_PATHS.signInCallback}`],
              redirectSignOut: [`${origin}${ADMIN_PATHS.signOutCallback}`],
              responseType: "code",
            },
          },
        },
      },
    },
    // Token cookies are httpOnly always; Strict is the library default, stated here so a
    // change of mind is a visible diff. The short-lived state/PKCE cookies the library sets
    // for the round trip to Cognito are Lax (they must survive the cross-site return).
    runtimeOptions: { cookies: { sameSite: "strict" } },
  });
}

let runner: ReturnType<typeof buildRunner> | undefined;

export function getAdminAuth(): ReturnType<typeof buildRunner> {
  runner ??= buildRunner();
  return runner;
}

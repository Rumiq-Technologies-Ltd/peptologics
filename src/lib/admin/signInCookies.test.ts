import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * The Strict-cookie question (ADR-038), answered against the real library with Cognito's
 * token endpoint faked: does the return from Cognito keep the state cookie?
 *
 * The browser sends a cookie on a navigation that starts at another site (Cognito sending the
 * visitor back to `/api/auth/sign-in-callback`) only if it is Lax or None, never Strict. So the
 * state/PKCE cookies must be Lax, while the token cookies, which are only ever read on our own
 * pages, can be Strict. This test pins both, so a library upgrade that changed either fails here.
 */
const ORIGIN = "https://staging.d10n0qgtlyryh5.amplifyapp.com";
const DOMAIN = "peptologics-staging.auth.us-east-1.amazoncognito.com";

type Handler = (req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => Promise<Response>;
let handler: Handler;

function jwt(payload: Record<string, unknown>): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "none" })}.${part(payload)}.sig`;
}

function setCookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

function cookieNamed(response: Response, fragment: string): string {
  const found = setCookies(response).find((cookie) => cookie.includes(fragment));
  if (!found) throw new Error(`no ${fragment} cookie`);
  return found;
}

beforeAll(async () => {
  process.env.AMPLIFY_APP_ORIGIN = ORIGIN;
  const { createServerRunner } = await import("@aws-amplify/adapter-nextjs");
  const { createAuthRouteHandlers } = createServerRunner({
    config: {
      Auth: {
        Cognito: {
          userPoolId: "us-east-1_AbCdEfGhI",
          userPoolClientId: "abcdefghij1234567890",
          loginWith: {
            oauth: {
              domain: DOMAIN,
              scopes: ["openid", "email"],
              redirectSignIn: [`${ORIGIN}/api/auth/sign-in-callback`],
              redirectSignOut: [`${ORIGIN}/api/auth/sign-out-callback`],
              responseType: "code",
            },
          },
        },
      },
    },
    runtimeOptions: { cookies: { sameSite: "strict" } },
  });

  const auth = createAuthRouteHandlers({ redirectOnSignInComplete: "/admin" });
  handler = (req, ctx) => auth(req, ctx) as Promise<Response>;
});

afterEach(() => vi.unstubAllGlobals());

describe("sign-in round trip with SameSite=Strict token cookies", () => {
  it("sets Lax state and PKCE cookies on the way out", async () => {
    const { NextRequest: Request } = await import("next/server");
    const response = await handler(new Request(`${ORIGIN}/api/auth/sign-in`), {
      params: Promise.resolve({ slug: "sign-in" }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain(`https://${DOMAIN}/oauth2/authorize`);
    expect(response.headers.get("location")).toContain("code_challenge");

    for (const name of ["server_auth.state", "server_auth.pkce"]) {
      const cookie = cookieNamed(response, name);
      expect(cookie).toMatch(/SameSite=lax/i);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Secure/i);
    }
  });

  it("accepts the return, then sets httpOnly Secure Strict token cookies on a 200", async () => {
    const { NextRequest: Request } = await import("next/server");
    const out = await handler(new Request(`${ORIGIN}/api/auth/sign-in`), {
      params: Promise.resolve({ slug: "sign-in" }),
    });
    const state = /server_auth\.state=([^;]+)/.exec(cookieNamed(out, "server_auth.state"))![1];
    const pkce = /server_auth\.pkce=([^;]+)/.exec(cookieNamed(out, "server_auth.pkce"))![1];

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          access_token: jwt({ username: "staff-1", sub: "s" }),
          id_token: jwt({ sub: "s", email: "staff@example.com" }),
          refresh_token: "refresh",
          expires_in: 1800,
          token_type: "Bearer",
        }),
      ),
    );

    // What the browser sends back from Cognito: only the Lax cookies, which is all it has.
    const back = await handler(
      new Request(`${ORIGIN}/api/auth/sign-in-callback?code=abc&state=${state}`, {
        headers: {
          cookie: `com.amplify.server_auth.state=${state}; com.amplify.server_auth.pkce=${pkce}`,
        },
      }),
      { params: Promise.resolve({ slug: "sign-in-callback" }) },
    );

    expect(back.status).toBe(200);
    expect(back.headers.get("content-type")).toContain("text/html");

    for (const suffix of [".accessToken", ".idToken", ".refreshToken"]) {
      const cookie = cookieNamed(back, suffix);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Secure/i);
      expect(cookie).toMatch(/SameSite=strict/i);
    }
  });

  it("refuses a return whose state does not match", async () => {
    const { NextRequest: Request } = await import("next/server");
    const response = await handler(
      new Request(`${ORIGIN}/api/auth/sign-in-callback?code=abc&state=forged`, {
        headers: {
          cookie: "com.amplify.server_auth.state=real; com.amplify.server_auth.pkce=p",
        },
      }),
      { params: Promise.resolve({ slug: "sign-in-callback" }) },
    );

    expect(response.status).toBe(400);
  });
});

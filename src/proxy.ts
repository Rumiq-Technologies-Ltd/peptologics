import { fetchAuthSession } from "aws-amplify/auth/server";
import { NextResponse, type NextRequest } from "next/server";

import { getAdminAuth } from "@/lib/admin/cognito.server";
import { buildAdminCsp } from "@/lib/admin/csp";
import { ADMIN_PATHS } from "@/lib/admin/paths";
import { adminEnabled, env } from "@/lib/env";

/** A path no route matches, so a rewrite to it is a plain 404. */
const DISABLED_REWRITE_PATH = "/page-not-found-admin-disabled";

/**
 * Next 16's `proxy` (formerly middleware), for `/admin/**` only (ADR-038).
 *
 * This is a convenience, not the security boundary. It does three things so pages do not have to:
 *
 * 1. Sends a signed-out visitor to sign-in before any page code runs.
 * 2. Refreshes an expired access token (they last 30 minutes) and writes the new cookies, which
 *    a Server Component cannot do. The refreshed cookies are also forwarded into this request,
 *    so the page sees the fresh tokens and does not spend the refresh token a second time.
 * 3. Sets the nonce-based CSP for the admin.
 *
 * It does not verify tokens. `requireAdmin` does, on every request, on the server.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Off means `/admin` does not exist. Rewriting to a path that matches nothing gives the same
  // 404 page as any unknown URL, rather than a distinguishable admin-flavoured one. (The admin
  // layout also refuses when disabled, as a backstop if this ever does not run.)
  if (!adminEnabled) return NextResponse.rewrite(new URL(DISABLED_REWRITE_PATH, request.url));

  const nonce = btoa(crypto.randomUUID());
  const csp = buildAdminCsp(nonce, env.NODE_ENV !== "production");

  const refreshed = NextResponse.next();

  const hasSession = await getAdminAuth().runWithAmplifyServerContext({
    nextServerContext: { request, response: refreshed },
    operation: async (context) => {
      const session = await fetchAuthSession(context);
      return Boolean(session.tokens?.accessToken && session.tokens.idToken);
    },
  });

  if (!hasSession) {
    return NextResponse.redirect(new URL(ADMIN_PATHS.signIn, env.NEXT_PUBLIC_SITE_URL));
  }

  // Forward any refreshed cookies into the request the page will see.
  const requestHeaders = new Headers(request.headers);
  const cookies = new Map(request.cookies.getAll().map(({ name, value }) => [name, value]));
  for (const { name, value } of refreshed.cookies.getAll()) cookies.set(name, value);
  requestHeaders.set("cookie", [...cookies].map(([name, value]) => `${name}=${value}`).join("; "));
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const cookie of refreshed.cookies.getAll()) response.cookies.set(cookie);
  response.headers.set("content-security-policy", csp);

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};

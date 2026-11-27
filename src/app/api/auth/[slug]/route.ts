import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";

import { recordAudit } from "@/features/admin/services/audit.service";
import { getAdminAuth } from "@/lib/admin/cognito.server";
import { ADMIN_PATHS } from "@/lib/admin/paths";
import { getAdminSession } from "@/lib/admin/session.server";
import { verifyTokenPair } from "@/lib/admin/tokens.server";
import { adminEnabled } from "@/lib/env";

/**
 * Sign-in and sign-out for the admin (ADR-038): `/api/auth/<slug>`.
 *
 * The library does the OAuth work: authorization-code flow with PKCE, the state check, and the
 * httpOnly cookies. This file only decides which of its routes exist and records the audit entries
 * for sign-in and sign-out.
 *
 * Cognito must list these exact URLs on the app client:
 * - `/api/auth/sign-in-callback`   (allowed callback)
 * - `/api/auth/sign-out-callback`  (allowed sign-out)
 *
 * `sign-up` is not served. Staff accounts are created by an administrator in Cognito.
 */
const SERVED_SLUGS = ["sign-in", "sign-in-callback", "sign-out", "sign-out-callback"] as const;

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const notFoundResponse = (): Response => new Response(null, { status: 404 });

/** A token cookie's value out of a response's `Set-Cookie` headers, by name suffix. */
function tokenFromSetCookie(response: Response, suffix: string): string | undefined {
  for (const header of response.headers.getSetCookie()) {
    const [pair] = header.split(";");
    const separator = pair.indexOf("=");
    if (pair.slice(0, separator).endsWith(suffix)) return pair.slice(separator + 1);
  }
  return undefined;
}

async function auditSignIn(response: Response): Promise<void> {
  const accessToken = tokenFromSetCookie(response, ".accessToken");
  const idToken = tokenFromSetCookie(response, ".idToken");
  if (!accessToken || !idToken) return;

  const session = await verifyTokenPair({ accessToken, idToken });
  if (!session) return;

  await recordAudit({
    actorEmail: session.email,
    actorRole: session.role,
    action: "sign_in",
    requestId: randomUUID(),
  });
}

async function auditSignOut(): Promise<void> {
  // Read the session before the library clears anything.
  const session = await getAdminSession();
  if (!session) return;

  await recordAudit({
    actorEmail: session.email,
    actorRole: session.role,
    action: "sign_out",
    requestId: randomUUID(),
  });
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  if (!adminEnabled) return notFoundResponse();

  const { slug } = await context.params;
  if (!(SERVED_SLUGS as readonly string[]).includes(slug)) return notFoundResponse();

  if (slug === "sign-out") await auditSignOut();

  const handler = getAdminAuth().createAuthRouteHandlers({
    redirectOnSignInComplete: ADMIN_PATHS.home,
    // Back to the public home page rather than straight into another sign-in prompt.
    redirectOnSignOutComplete: "/",
  });

  const response = (await handler(request, context)) as Response;

  // 200 is the successful callback: the library answers with the cookies and a client redirect.
  if (slug === "sign-in-callback" && response.status === 200) await auditSignIn(response);

  return response;
}

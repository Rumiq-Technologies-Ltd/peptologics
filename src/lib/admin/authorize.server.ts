import "server-only";

import { randomUUID } from "node:crypto";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { recordAudit } from "@/features/admin/services/audit.service";
import { adminEnabled, env } from "@/lib/env";
import { isAllowedOrigin } from "@/lib/security/origin";

import { ADMIN_PATHS } from "./paths";
import { roleSatisfies, type AdminRole } from "./roles";
import { getAdminSession } from "./session.server";
import type { VerifiedSession } from "./tokens.server";

/**
 * The single authorization check for the admin (ADR-038). Every admin page, server action and
 * route handler calls it, on every request. `proxy.ts` redirects signed-out visitors as a
 * convenience; this is the security boundary.
 */
export interface AdminAccessOptions {
  /** The minimum role. `"editor"` admits editors and owners; `"owner"` admits owners only. */
  role: AdminRole;
  /** True for anything that changes data: also requires the request to come from our own origin. */
  mutating?: boolean;
}

export interface AdminAccess extends VerifiedSession {
  role: AdminRole;
}

export type AdminAccessResult =
  | { ok: true; session: AdminAccess }
  | {
      ok: false;
      reason: "disabled" | "unauthenticated" | "no_access" | "forbidden" | "bad_origin";
    };

/** The request's id for the audit log: CloudFront's when present, otherwise a fresh one. */
export async function requestId(): Promise<string> {
  const incoming = (await headers()).get("x-amz-cf-id");
  return incoming ?? randomUUID();
}

async function checkOrigin(): Promise<boolean> {
  const origin = (await headers()).get("origin");
  // A browser always sends Origin on a cross-origin POST. Absent means not a browser form post
  // from another site; present must be ours.
  return !origin || isAllowedOrigin(origin, env.NEXT_PUBLIC_SITE_URL);
}

/** The checked access, as data. Route handlers use this to answer 401 or 403 themselves. */
async function evaluate(role: AdminRole, mutating: boolean): Promise<AdminAccessResult> {
  if (!adminEnabled) return { ok: false, reason: "disabled" };

  const session = await getAdminSession();
  if (!session) return { ok: false, reason: "unauthenticated" };

  if (mutating && !(await checkOrigin())) return { ok: false, reason: "bad_origin" };

  if (!session.role) {
    await recordAudit({
      actorEmail: session.email,
      actorRole: null,
      action: "access_denied",
      target: "no group",
      requestId: await requestId(),
    });
    return { ok: false, reason: "no_access" };
  }

  if (!roleSatisfies(session.role, role)) {
    await recordAudit({
      actorEmail: session.email,
      actorRole: session.role,
      action: "access_denied",
      target: `needs ${role}`,
      requestId: await requestId(),
    });
    return { ok: false, reason: "forbidden" };
  }

  return { ok: true, session: { ...session, role: session.role } };
}

// Cached per render so a layout and its page do not write the same denial twice.
const evaluateCached = cache(evaluate);

export function authorizeAdmin(options: AdminAccessOptions): Promise<AdminAccessResult> {
  return options.mutating ? evaluate(options.role, true) : evaluateCached(options.role, false);
}

/**
 * For pages and server actions. Disabled is a 404, signed out goes to sign-in, and a signed-in
 * person without the right group goes to "No access". Returns the session when allowed.
 */
export async function requireAdmin(options: AdminAccessOptions): Promise<AdminAccess> {
  const result = await authorizeAdmin(options);
  if (result.ok) return result.session;

  switch (result.reason) {
    case "disabled":
      notFound();
    case "unauthenticated":
      redirect(ADMIN_PATHS.signIn);
    case "bad_origin":
      throw new Error("Cross-origin admin request refused.");
    default:
      redirect(ADMIN_PATHS.noAccess);
  }
}

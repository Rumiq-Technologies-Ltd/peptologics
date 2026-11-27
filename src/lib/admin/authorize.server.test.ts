import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  enabled: true,
  session: null as null | { sub: string; email: string; role: "owner" | "editor" | null },
  origin: null as string | null,
  audit: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  get adminEnabled() {
    return state.enabled;
  },
  env: { NEXT_PUBLIC_SITE_URL: "https://peptologics.com" },
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  // `cache` only exists in the server build of React; a pass-through is what a single call sees.
  cache: <T>(fn: T) => fn,
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(state.origin ? { origin: state.origin } : {}),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/admin/session.server", () => ({ getAdminSession: async () => state.session }));
vi.mock("@/features/admin/services/audit.service", () => ({ recordAudit: state.audit }));

import { authorizeAdmin, requireAdmin } from "@/lib/admin/authorize.server";

beforeEach(() => {
  state.enabled = true;
  state.session = null;
  state.origin = null;
  state.audit.mockReset();
});

describe("authorizeAdmin", () => {
  it("refuses when the admin is disabled", async () => {
    state.enabled = false;
    expect(await authorizeAdmin({ role: "editor" })).toEqual({ ok: false, reason: "disabled" });
  });

  it("refuses without a session, and does not audit it", async () => {
    expect(await authorizeAdmin({ role: "editor" })).toEqual({
      ok: false,
      reason: "unauthenticated",
    });
    expect(state.audit).not.toHaveBeenCalled();
  });

  it("refuses a signed-in person in no group, and audits the denial", async () => {
    state.session = { sub: "s", email: "x@example.com", role: null };

    expect(await authorizeAdmin({ role: "editor" })).toEqual({ ok: false, reason: "no_access" });
    expect(state.audit).toHaveBeenCalledWith(
      expect.objectContaining({ actorEmail: "x@example.com", action: "access_denied" }),
    );
  });

  it("lets an editor in for editor work but not owner work", async () => {
    state.session = { sub: "s", email: "e@example.com", role: "editor" };

    expect((await authorizeAdmin({ role: "editor" })).ok).toBe(true);
    expect(await authorizeAdmin({ role: "owner" })).toEqual({ ok: false, reason: "forbidden" });
    expect(state.audit).toHaveBeenCalledWith(
      expect.objectContaining({ actorRole: "editor", action: "access_denied" }),
    );
  });

  it("lets an owner do both", async () => {
    state.session = { sub: "s", email: "o@example.com", role: "owner" };

    expect((await authorizeAdmin({ role: "editor" })).ok).toBe(true);
    expect((await authorizeAdmin({ role: "owner" })).ok).toBe(true);
  });

  it("refuses a mutating request from another origin", async () => {
    state.session = { sub: "s", email: "o@example.com", role: "owner" };
    state.origin = "https://evil.example";

    expect(await authorizeAdmin({ role: "editor", mutating: true })).toEqual({
      ok: false,
      reason: "bad_origin",
    });
  });

  it("accepts a mutating request from our own origin", async () => {
    state.session = { sub: "s", email: "o@example.com", role: "owner" };
    state.origin = "https://peptologics.com";

    expect((await authorizeAdmin({ role: "editor", mutating: true })).ok).toBe(true);
  });
});

describe("requireAdmin", () => {
  it("404s when disabled", async () => {
    state.enabled = false;
    await expect(requireAdmin({ role: "editor" })).rejects.toThrow("NOT_FOUND");
  });

  it("sends a signed-out visitor to sign-in", async () => {
    await expect(requireAdmin({ role: "editor" })).rejects.toThrow("REDIRECT:/api/auth/sign-in");
  });

  it("sends a person without the right role to No access", async () => {
    state.session = { sub: "s", email: "e@example.com", role: "editor" };
    await expect(requireAdmin({ role: "owner" })).rejects.toThrow("REDIRECT:/admin/no-access");
  });

  it("returns the session when allowed", async () => {
    state.session = { sub: "s", email: "o@example.com", role: "owner" };
    expect(await requireAdmin({ role: "owner" })).toMatchObject({
      email: "o@example.com",
      role: "owner",
    });
  });
});

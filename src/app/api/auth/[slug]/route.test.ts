import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const state = vi.hoisted(() => ({ enabled: false, handler: vi.fn() }));

vi.mock("@/lib/env", () => ({
  get adminEnabled() {
    return state.enabled;
  },
}));
vi.mock("@/lib/admin/cognito.server", () => ({
  getAdminAuth: () => ({ createAuthRouteHandlers: () => state.handler }),
}));
vi.mock("@/lib/admin/session.server", () => ({ getAdminSession: async () => null }));
vi.mock("@/lib/admin/tokens.server", () => ({ verifyTokenPair: async () => null }));
vi.mock("@/features/admin/services/audit.service", () => ({ recordAudit: vi.fn() }));

import { GET } from "./route";

const call = (slug: string) => GET({} as NextRequest, { params: Promise.resolve({ slug }) });

beforeEach(() => {
  state.enabled = true;
  state.handler.mockReset();
  state.handler.mockResolvedValue(new Response(null, { status: 302 }));
});

describe("/api/auth/[slug]", () => {
  it("is a 404 for every slug when the admin is disabled", async () => {
    state.enabled = false;

    for (const slug of ["sign-in", "sign-in-callback", "sign-out", "sign-out-callback"]) {
      expect((await call(slug)).status).toBe(404);
    }
    expect(state.handler).not.toHaveBeenCalled();
  });

  it("serves the four sign-in and sign-out routes", async () => {
    for (const slug of ["sign-in", "sign-in-callback", "sign-out", "sign-out-callback"]) {
      expect((await call(slug)).status).toBe(302);
    }
    expect(state.handler).toHaveBeenCalledTimes(4);
  });

  it("does not offer sign-up, or any other slug", async () => {
    expect((await call("sign-up")).status).toBe(404);
    expect((await call("anything")).status).toBe(404);
    expect(state.handler).not.toHaveBeenCalled();
  });
});

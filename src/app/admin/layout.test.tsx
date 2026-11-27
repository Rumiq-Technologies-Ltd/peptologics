import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ enabled: false }));

vi.mock("@/lib/env", () => ({
  get adminEnabled() {
    return state.enabled;
  },
}));
vi.mock("@/components/layout/fonts", () => ({
  displaySans: { variable: "a" },
  plexMono: { variable: "b" },
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

import AdminRootLayout from "./layout";

beforeEach(() => {
  state.enabled = false;
});

describe("the admin root layout", () => {
  it("is a 404 when the admin is disabled, so /admin does not exist in production", () => {
    expect(() => AdminRootLayout({ children: null } as never)).toThrow("NOT_FOUND");
  });

  it("renders when enabled", () => {
    state.enabled = true;
    expect(() => AdminRootLayout({ children: null } as never)).not.toThrow();
  });
});

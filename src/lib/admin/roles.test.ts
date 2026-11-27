import { describe, expect, it } from "vitest";

import { resolveAdminRole, roleSatisfies } from "@/lib/admin/roles";

describe("resolveAdminRole", () => {
  it("maps the owner and editor groups", () => {
    expect(resolveAdminRole(["owner"])).toBe("owner");
    expect(resolveAdminRole(["editor"])).toBe("editor");
  });

  it("gives an owner who is also an editor the owner role", () => {
    expect(resolveAdminRole(["editor", "owner"])).toBe("owner");
  });

  it("gives no role to no groups, other groups, or a near miss", () => {
    expect(resolveAdminRole(undefined)).toBeNull();
    expect(resolveAdminRole([])).toBeNull();
    expect(resolveAdminRole(["admins", "Owner", "editors"])).toBeNull();
  });
});

describe("roleSatisfies", () => {
  it("lets owners do everything and editors only editor things", () => {
    expect(roleSatisfies("owner", "owner")).toBe(true);
    expect(roleSatisfies("owner", "editor")).toBe(true);
    expect(roleSatisfies("editor", "editor")).toBe(true);
    expect(roleSatisfies("editor", "owner")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { buildAdminCsp } from "@/lib/admin/csp";

describe("buildAdminCsp", () => {
  const csp = buildAdminCsp("abc123", false);

  it("allows scripts only by nonce, with no unsafe-inline", () => {
    const scriptSrc = csp.split("; ").find((directive) => directive.startsWith("script-src"));

    expect(scriptSrc).toContain("'nonce-abc123'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("cannot be framed and keeps the other lockdowns", () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("connect-src 'self'");
  });

  it("allows eval in development only", () => {
    expect(buildAdminCsp("n", true)).toContain("'unsafe-eval'");
  });
});

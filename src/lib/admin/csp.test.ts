import { describe, expect, it } from "vitest";

import { buildAdminCsp, mediaUploadOrigin } from "@/lib/admin/csp";

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

describe("product image upload origin", () => {
  it("allows a direct PUT to the media bucket and nothing else new", () => {
    const origin = mediaUploadOrigin("peptologics-media-staging", "us-east-1");
    expect(origin).toBe("https://peptologics-media-staging.s3.us-east-1.amazonaws.com");

    const csp = buildAdminCsp("n", false, origin);
    expect(csp).toContain(`connect-src 'self' ${origin}`);
    expect(csp).toContain("default-src 'self'");
  });

  it("stays on our own origin when no bucket is configured", () => {
    expect(mediaUploadOrigin(undefined, "us-east-1")).toBeUndefined();
    expect(buildAdminCsp("n", false)).toContain("connect-src 'self';");
  });
});

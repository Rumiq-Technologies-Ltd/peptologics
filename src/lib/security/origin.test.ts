import { describe, expect, it } from "vitest";

import { isAllowedOrigin } from "@/lib/security/origin";

/**
 * The inquiry endpoint refuses any cross-origin POST. These cases pin down what counts as
 * "ours", because a rule that is too tight breaks real visitors (the www host was rejected
 * with a 403) and one that is too loose lets another site post on a visitor's behalf.
 */

const SITE = "https://peptologics.com";

describe("isAllowedOrigin", () => {
  it("accepts the configured origin", () => {
    expect(isAllowedOrigin("https://peptologics.com", SITE)).toBe(true);
  });

  it("accepts the www twin of an apex site", () => {
    expect(isAllowedOrigin("https://www.peptologics.com", SITE)).toBe(true);
  });

  it("accepts the apex when the configured site is the www host", () => {
    expect(isAllowedOrigin("https://peptologics.com", "https://www.peptologics.com")).toBe(true);
  });

  it("ignores a trailing slash or path on the configured site URL", () => {
    expect(isAllowedOrigin("https://www.peptologics.com", "https://peptologics.com/")).toBe(true);
  });

  it("refuses a different scheme", () => {
    expect(isAllowedOrigin("http://peptologics.com", SITE)).toBe(false);
  });

  it("refuses a different port", () => {
    expect(isAllowedOrigin("https://peptologics.com:8443", SITE)).toBe(false);
  });

  it.each([
    "https://evil.example",
    "https://peptologics.com.evil.example",
    "https://evilpeptologics.com",
    "https://wwwpeptologics.com",
    "https://www.evil.peptologics.com",
    "https://evil.peptologics.com",
    "https://www.www.peptologics.com",
  ])("refuses the lookalike or foreign host %s", (origin) => {
    expect(isAllowedOrigin(origin, SITE)).toBe(false);
  });

  it.each(["null", "", "not a url", "javascript:alert(1)"])(
    "refuses an unparseable or non-http origin (%j)",
    (origin) => {
      expect(isAllowedOrigin(origin, SITE)).toBe(false);
    },
  );

  it("refuses everything when the configured site URL is itself unparseable", () => {
    expect(isAllowedOrigin("https://peptologics.com", "not a url")).toBe(false);
  });

  it("works for local development", () => {
    expect(isAllowedOrigin("http://localhost:3000", "http://localhost:3000")).toBe(true);
    expect(isAllowedOrigin("http://localhost:4000", "http://localhost:3000")).toBe(false);
  });
});

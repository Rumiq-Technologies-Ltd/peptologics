import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Only APP_ENV=production may be open to crawlers. Unset (a developer machine), development
 * and staging all disallow everything, so a staging build cannot be indexed (ADR-032).
 */

async function robotsFor(appEnv: string | undefined) {
  vi.resetModules();
  vi.doMock("@/lib/env", () => ({ env: { APP_ENV: appEnv } }));
  vi.doMock("@/lib/env.client", () => ({ siteUrl: "https://peptologics.com" }));

  const { default: robots } = await import("@/app/robots");
  return robots();
}

afterEach(() => {
  vi.doUnmock("@/lib/env");
  vi.doUnmock("@/lib/env.client");
});

describe("robots", () => {
  it.each([undefined, "development", "staging"])(
    "disallows everything for APP_ENV=%s",
    async (appEnv) => {
      expect(await robotsFor(appEnv)).toEqual({ rules: { userAgent: "*", disallow: "/" } });
    },
  );

  it("is open to crawlers for APP_ENV=production", async () => {
    const result = await robotsFor("production");

    expect(result.rules).toEqual({ userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] });
    expect(result.sitemap).toBe("https://peptologics.com/sitemap.xml");
  });
});

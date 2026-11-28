import { expect, test } from "@playwright/test";

/**
 * The admin's front door (ADR-038).
 *
 * The e2e server runs on the default data store with no Cognito settings, which is exactly the
 * deployment the admin must be invisible on, so the always-on test is that `/admin` and the
 * sign-in routes are plain 404s.
 *
 * The signed-out redirect needs a server with the admin switched on (DynamoDB store, the three
 * Cognito variables, and an APP_ENV other than production). That is not the default e2e server,
 * so the test runs only when `E2E_ADMIN_ENABLED=1` says the server was started that way.
 * Signed-in flows are checked by hand on staging with a test user.
 */
test.describe("admin disabled (the default server)", () => {
  test.skip(process.env.E2E_ADMIN_ENABLED === "1", "server has the admin enabled");

  for (const path of [
    "/admin",
    "/admin/no-access",
    "/admin/products",
    "/admin/products/new",
    "/admin/orders",
    "/admin/orders/PL-001032",
    "/api/auth/sign-in",
    "/api/auth/sign-up",
  ]) {
    test(`${path} is a 404`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(404);
    });
  }
});

test.describe("admin enabled", () => {
  test.skip(process.env.E2E_ADMIN_ENABLED !== "1", "needs a server with the admin enabled");

  test("signed out, /admin redirects to sign-in", async ({ request }) => {
    const response = await request.get("/admin", { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(new URL(response.headers().location).pathname).toBe("/api/auth/sign-in");
  });

  for (const path of [
    "/admin/products",
    "/admin/products/new",
    "/admin/orders",
    "/admin/orders/PL-001032",
  ]) {
    test(`signed out, ${path} redirects to sign-in`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });

      expect(response.status()).toBe(307);
      expect(new URL(response.headers().location).pathname).toBe("/api/auth/sign-in");
    });
  }

  test("sign-in sends the browser to Cognito, with PKCE", async ({ request }) => {
    const response = await request.get("/api/auth/sign-in", { maxRedirects: 0 });

    expect(response.status()).toBe(302);
    expect(response.headers().location).toContain("/oauth2/authorize");
    expect(response.headers().location).toContain("code_challenge");
  });
});

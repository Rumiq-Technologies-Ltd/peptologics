/**
 * Admin and sign-in paths in one place. The two callback paths are registered on the Cognito
 * app client, so changing them means changing the pool (see docs/admin.md).
 */
export const ADMIN_PATHS = {
  home: "/admin",
  noAccess: "/admin/no-access",
  signIn: "/api/auth/sign-in",
  signOut: "/api/auth/sign-out",
  signInCallback: "/api/auth/sign-in-callback",
  signOutCallback: "/api/auth/sign-out-callback",
} as const;

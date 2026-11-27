/**
 * Admin roles (D35, ADR-038). Pure: no env, no Next, so the rule is testable on its own.
 *
 * A role is the Cognito group a person belongs to. Owners can do everything; editors can
 * work on products, content and orders but not settings or staff.
 */
export const ADMIN_ROLES = ["owner", "editor"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

/** The role granted by a `cognito:groups` claim. An owner who is also an editor is an owner. */
export function resolveAdminRole(groups: readonly string[] | undefined): AdminRole | null {
  if (!groups) return null;
  return ADMIN_ROLES.find((role) => groups.includes(role)) ?? null;
}

/** Whether `actual` is allowed to do what `required` is the minimum role for. */
export function roleSatisfies(actual: AdminRole, required: AdminRole): boolean {
  return required === "editor" || actual === "owner";
}

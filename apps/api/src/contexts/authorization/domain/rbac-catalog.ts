/**
 * Platform roles the code depends on by name. They are seeded with `isSystem = true`
 * (`infrastructure/reference-data/system-role-catalog.ts`, loaded by `db:sync-reference-data`).
 */
export const SUPER_ADMIN_ROLE_NAME = "SuperAdmin";
export const ADMIN_ROLE_NAME = "Admin";

/** Platform role attached to every self-provisioned consumer account (signup, merchant onboarding, invite registration). */
export const DEFAULT_CONSUMER_ROLE_NAME = "User";

/**
 * Roles that must always keep at least one active holder. An RBAC change that would leave one of them
 * without an active, non-deleted user is rejected, so the platform can never lock itself out of
 * authorization administration.
 */
export const LAST_HOLDER_PROTECTED_ROLE_NAMES: readonly [string, string] = [SUPER_ADMIN_ROLE_NAME, ADMIN_ROLE_NAME];

/** Upper bound on directly assigned roles per user (role-design guard rail). */
export const MAX_ROLES_PER_USER = 10;

/** A pair of roles one user must never hold at the same time (separation of duties). */
export interface RoleSeparationOfDutyRule {
	readonly roleA: string;
	readonly roleB: string;
	readonly reason: string;
}

/**
 * Separation-of-duty rules enforced on every write that changes a user's effective role set (assign,
 * sync, re-parent, restore, re-activate) and by `POST /admin/roles/:id/validate-assignment`. Roles are
 * matched by name against the user's effective set (direct roles plus inherited ancestors), so they
 * reference system roles, which cannot be renamed through the API.
 *
 * Extend this list in a product built on the kit. An empty list is valid but disables SoD enforcement.
 */
export const ROLE_SEPARATION_OF_DUTY_RULES: readonly RoleSeparationOfDutyRule[] = [
	{
		roleA: "Store Manager",
		roleB: "Store Staff",
		reason: "A store member holds exactly one store role; Store Manager already includes front-of-house duties",
	},
];

/** `ACTION:RESOURCE`, the key a permission pair is compared by everywhere in RBAC. */
export function permissionKeyOf(pair: { readonly action: string; readonly resource: string }): string {
	return `${pair.action}:${pair.resource}`;
}

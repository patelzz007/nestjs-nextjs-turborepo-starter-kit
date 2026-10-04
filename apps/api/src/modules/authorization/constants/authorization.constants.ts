import type { PermissionAction, PermissionResource } from "@workspace/shared";

/** Metadata key for permission-based route guards. */
export const REQUIRED_PERMISSIONS_KEY = "requiredPermissions";

/** Metadata key for role-based route guards. */
export const REQUIRED_ROLES_KEY = "requiredRoles";

/** Legacy key used by the existing @RequirePermission decorator. */
export const REQUIRED_PERMISSION_KEY = "requiredPermission";

/** Shape of the metadata set by @RequireAllPermissions / @RequireAnyPermission. */
export interface RequiredPermissionsMetadata {
	readonly mode: "all" | "any";
	readonly permissions: readonly [PermissionAction, PermissionResource][];
}

/** Shape of the metadata set by @RequireAllRoles / @RequireAnyRole. */
export interface RequiredRolesMetadata {
	readonly mode: "all" | "any";
	readonly roles: readonly string[];
}

/** Shape of the metadata set by the legacy @RequirePermission decorator. */
export interface RequiredPermission {
	readonly action: PermissionAction;
	readonly resource: PermissionResource;
}

// ── RBAC administration invariants ──────────────────────────────────────────

/**
 * Platform roles the code depends on by name — seeded with `isSystem = true`
 * (`reference-data/system-role-catalog.ts`, synced by `db:sync-reference-data`).
 */
export const SUPER_ADMIN_ROLE_NAME = "SuperAdmin";
export const ADMIN_ROLE_NAME = "Admin";

/**
 * Roles that must always keep at least one active holder: an RBAC change that
 * would leave one of them without an active, non-deleted user is rejected, so
 * the platform can never lock itself out of authorization administration.
 */
export const LAST_HOLDER_PROTECTED_ROLE_NAMES: readonly [string, string] = [SUPER_ADMIN_ROLE_NAME, ADMIN_ROLE_NAME];

/** Upper bound on directly assigned roles per user (role-design guard rail). */
export const MAX_ROLES_PER_USER = 10;

/**
 * `pg_advisory_xact_lock` key that serializes every RBAC mutation. RBAC writes
 * are rare, and their invariants (privilege subset, last protected holder,
 * separation of duties) read state other writers change — one lock makes each
 * check-then-write race-free without per-row bookkeeping. Arbitrary but fixed
 * 64-bit value; must not collide with other advisory-lock users.
 */
export const RBAC_MUTATION_ADVISORY_LOCK_KEY = 7_324_150_901_011n;

/** A pair of roles one user must never hold at the same time (separation of duties). */
export interface RoleSeparationOfDutyRule {
	readonly roleA: string;
	readonly roleB: string;
	readonly reason: string;
}

/**
 * Separation-of-duty rules enforced on every write that changes a user's
 * effective role set (assign, sync, re-parent, restore, re-activate) and by
 * `POST /admin/roles/:id/validate-assignment`. Roles are matched by name
 * against the user's effective set (direct roles plus inherited ancestors), so
 * reference system roles — they cannot be renamed through the API.
 *
 * Extend this list in a product built on the kit; an empty list is valid but
 * disables SoD enforcement.
 */
export const ROLE_SEPARATION_OF_DUTY_RULES: readonly RoleSeparationOfDutyRule[] = [
	{
		roleA: "Store Manager",
		roleB: "Store Staff",
		reason: "A store member holds exactly one store role; Store Manager already includes front-of-house duties",
	},
];

/** Platform role attached to every self-provisioned consumer account (signup, merchant onboarding, invite registration). */
export const DEFAULT_CONSUMER_ROLE_NAME = "User";
